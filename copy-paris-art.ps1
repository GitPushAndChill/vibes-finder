# PowerShell script: Copy paris_art1.jpg to every images path in posts-places copy.json

# Path to your JSON file and source image
$jsonPath = "posts/places/posts-places copy.json"
$srcImage = "images/places/paris_art1.jpg"

# Read and parse the JSON
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

foreach ($post in $json) {
    foreach ($imgPath in $post.images) {
        $dest = $imgPath -replace "/", "\"
        Copy-Item $srcImage $dest -Force
    }
}
Write-Host "Done copying paris_art1.jpg to all post image paths."