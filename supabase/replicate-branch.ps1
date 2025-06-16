# Script to replicate database from main to staging branch
# Usage: .\replicate-branch.ps1

# Get project reference and database password from .env file
$projectRef = ""
$dbPassword = ""
if (Test-Path .env) {
    $envContent = Get-Content .env
    foreach ($line in $envContent) {
        if ($line -match "SUPABASE_PROJECT_REF=(.+)") {
            $projectRef = $matches[1]
        }
        if ($line -match "SUPABASE_PROJECT_DB_PASSWORD=(.+)") {
            $dbPassword = $matches[1]
        }
    }
}

if (-not $projectRef) {
    Write-Error "Could not find SUPABASE_PROJECT_REF in .env file"
    exit 1
}

if (-not $dbPassword) {
    Write-Error "Could not find SUPABASE_PROJECT_DB_PASSWORD in .env file"
    exit 1
}

Write-Host "Starting database replication from main to staging branch..."

# Set database connection parameters
$dbHost = "$projectRef.supabase.co"  # Using the URL from your .env file
$dbPort = "5432"
$dbName = "postgres"
$dbUser = "postgres"

# Create backup of main branch schema
Write-Host "Creating backup of main branch schema..."
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "main_schema_$timestamp.sql"

# Use pg_dump to create schema backup
$env:PGPASSWORD = $dbPassword
pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName --schema-only -f $backupFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create schema backup"
    exit 1
}

Write-Host "Schema backup created successfully: $backupFile"
Write-Host "Please use the Supabase Dashboard to create and manage database branches."
Write-Host "You can find the backup file at: $backupFile" 