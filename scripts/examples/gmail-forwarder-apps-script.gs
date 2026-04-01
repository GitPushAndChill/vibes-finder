const GMAIL_FORWARDER_CONFIG = {
  sourceLabel: 'vibesfinder/import',
  subjectMustContain: 'vibesfinder/import',
  processedLabel: 'vibesfinder/imported',
  failedLabel: 'vibesfinder/import-failed',
  // Use Drive URLs to avoid GitHub repository_dispatch payload-size limits.
  attachmentMode: 'drive_url', // 'drive_url' or 'base64'
  driveFolderId: '',
  driveFolderName: 'vibesfinder-email-images',
  githubOwner: 'GitPushAndChill',
  githubRepo: 'test-website',
  eventType: 'gmail_forwarded_email',
  maxImageAttachments: 6,
  maxThreadsPerRun: 10,
};

function forwardLabeledGmailPostsToGitHub() {
  const config = GMAIL_FORWARDER_CONFIG;
  const githubToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  const startedAt = new Date();

  if (!githubToken) {
    throw new Error('Missing GITHUB_TOKEN in Script Properties.');
  }

  const sourceLabel = getOrCreateLabel_(config.sourceLabel);
  const processedLabel = getOrCreateLabel_(config.processedLabel);
  const failedLabel = getOrCreateLabel_(config.failedLabel);
  const threads = sourceLabel.getThreads(0, config.maxThreadsPerRun);

  const stats = {
    threadsSeen: threads.length,
    skippedSubjectMismatch: 0,
    processed: 0,
    skippedAlreadyProcessed: 0,
    failed: 0,
    attachmentsForwarded: 0,
  };

  Logger.log(
    '[gmail-forwarder] Run started at %s. threadsSeen=%s label=%s',
    startedAt.toISOString(),
    stats.threadsSeen,
    config.sourceLabel
  );

  threads.forEach((thread) => {
    if (threadHasLabel_(thread, processedLabel)) {
      stats.skippedAlreadyProcessed += 1;
      return;
    }

    const message = thread.getMessages().pop();
    const subject = message ? message.getSubject() : '(no subject)';

    if (!subjectContainsRequiredMarker_(subject, config.subjectMustContain)) {
      stats.skippedSubjectMismatch += 1;
      Logger.log(
        '[gmail-forwarder] Skipped subject mismatch subject="%s" requiredContains="%s"',
        subject,
        config.subjectMustContain
      );
      return;
    }

    try {
      const payload = buildRepositoryDispatchPayload_(message, config);
      const attachmentCount = payload.client_payload.email.attachments.length;
      sendRepositoryDispatch_(payload, githubToken, config);

      stats.processed += 1;
      stats.attachmentsForwarded += attachmentCount;

      thread.addLabel(processedLabel);
      thread.removeLabel(failedLabel);
      thread.markRead();

      Logger.log(
        '[gmail-forwarder] Dispatched subject="%s" attachments=%s',
        subject,
        attachmentCount
      );
    } catch (err) {
      stats.failed += 1;
      thread.addLabel(failedLabel);

      Logger.log(
        '[gmail-forwarder] Failed subject="%s" error=%s',
        subject,
        err && err.message ? err.message : String(err)
      );
    }
  });

  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();
  Logger.log(
    '[gmail-forwarder] Run finished at %s. processed=%s skippedAlreadyProcessed=%s skippedSubjectMismatch=%s failed=%s attachmentsForwarded=%s durationMs=%s',
    endedAt.toISOString(),
    stats.processed,
    stats.skippedAlreadyProcessed,
    stats.skippedSubjectMismatch,
    stats.failed,
    stats.attachmentsForwarded,
    durationMs
  );
}

function subjectContainsRequiredMarker_(subject, marker) {
  const required = String(marker || '').trim().toLowerCase();
  if (!required) return true;
  return String(subject || '').toLowerCase().indexOf(required) >= 0;
}

function buildRepositoryDispatchPayload_(message, config) {
  const plainBody = message.getPlainBody() || '';
  const htmlBody = message.getBody() || '';
  const attachments = message
    .getAttachments({ includeInlineImages: true, includeAttachments: true })
    .filter(isImageAttachment_)
    .slice(0, config.maxImageAttachments)
    .map((attachment) => toWebhookAttachment_(attachment, config));

  Logger.log('[gmail-forwarder] Payload build found %s image attachment(s). mode=%s', attachments.length, config.attachmentMode);

  const googleMapsUrl = findGoogleMapsUrl_(plainBody, htmlBody);

  return {
    event_type: config.eventType,
    client_payload: {
      email: {
        subject: message.getSubject() || '',
        from: message.getFrom() || '',
        text: plainBody,
        // Keep payload small; plain text is enough for downstream parsing.
        html: '',
        attachments: attachments,
      },
      google_maps_url: googleMapsUrl,
      place: '',
      city: '',
    },
  };
}

function sendRepositoryDispatch_(payload, githubToken, config) {
  const url = `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/dispatches`;
  const requestBody = JSON.stringify(payload);

  Logger.log('[gmail-forwarder] Dispatch request url=%s', url);
  Logger.log('[gmail-forwarder] Dispatch request auth=Bearer ***redacted*** tokenLength=%s', String(githubToken || '').length);
  Logger.log('[gmail-forwarder] Dispatch request payload=%s', requestBody);

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    },
    payload: requestBody,
  });

  const status = response.getResponseCode();
  const responseText = response.getContentText();
  Logger.log('[gmail-forwarder] Dispatch response status=%s body=%s', status, responseText);

  if (status < 200 || status >= 300) {
    throw new Error(`GitHub dispatch failed (${status}): ${responseText}`);
  }
}

function isImageAttachment_(attachment) {
  const contentType = String(attachment.getContentType() || '').toLowerCase();
  const name = String(attachment.getName() || '').toLowerCase();
  return contentType.indexOf('image/') === 0 || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(name);
}

function toWebhookAttachment_(attachment, config) {
  const mode = String(config.attachmentMode || 'drive_url').toLowerCase();

  if (mode === 'base64') {
    const bytes = attachment.copyBlob().getBytes();
    return {
      filename: attachment.getName(),
      contentType: attachment.getContentType(),
      contentBase64: Utilities.base64Encode(bytes),
    };
  }

  const downloadUrl = uploadAttachmentToDriveAndGetDownloadUrl_(attachment, config);
  return {
    filename: attachment.getName(),
    contentType: attachment.getContentType(),
    url: downloadUrl,
  };
}

function uploadAttachmentToDriveAndGetDownloadUrl_(attachment, config) {
  const folder = resolveDriveFolder_(config);
  const blob = attachment.copyBlob();
  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  const safeName = `${timestamp}-${attachment.getName()}`;
  blob.setName(safeName);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const id = file.getId();
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function resolveDriveFolder_(config) {
  if (config.driveFolderId) {
    return DriveApp.getFolderById(config.driveFolderId);
  }

  const folderName = String(config.driveFolderName || 'vibesfinder-email-images').trim();
  const existing = DriveApp.getFoldersByName(folderName);
  if (existing.hasNext()) {
    const folder = existing.next();
    Logger.log('[gmail-forwarder] Using Drive folder by name="%s" id=%s', folderName, folder.getId());
    return folder;
  }

  const created = DriveApp.createFolder(folderName);
  Logger.log('[gmail-forwarder] Created Drive folder name="%s" id=%s', folderName, created.getId());
  return created;
}

function findGoogleMapsUrl_(plainBody, htmlBody) {
  const body = `${plainBody || ''}\n${stripHtml_(htmlBody || '')}`;
  const match = body.match(/https?:\/\/(?:www\.)?(?:google\.[^\s/]+\/maps|maps\.app\.goo\.gl)\S+/i);
  if (!match) {
    throw new Error('No Google Maps URL found in Gmail message body.');
  }
  return match[0];
}

function stripHtml_(html) {
  return String(html || '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getOrCreateLabel_(name) {
  const existing = GmailApp.getUserLabelByName(name);
  return existing || GmailApp.createLabel(name);
}

function threadHasLabel_(thread, label) {
  const labelName = label.getName();
  return thread.getLabels().some((item) => item.getName() === labelName);
}

function testForwardLatestMatchingEmail() {
  const sourceLabel = getOrCreateLabel_(GMAIL_FORWARDER_CONFIG.sourceLabel);
  const threads = sourceLabel.getThreads(0, 1);
  if (!threads.length) {
    throw new Error(`No threads found for label ${GMAIL_FORWARDER_CONFIG.sourceLabel}`);
  }

  const message = threads[0].getMessages().pop();
  const payload = buildRepositoryDispatchPayload_(message, GMAIL_FORWARDER_CONFIG);
  Logger.log(JSON.stringify(payload, null, 2));
}