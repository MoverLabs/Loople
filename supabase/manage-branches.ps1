# Script to manage Supabase branches (staging and main)
# Usage: .\manage-branches.ps1 <command> [options]
# Commands:
#   reset-staging    - Reset staging database with latest schema
#   deploy-functions - Deploy functions to specified branch
#   list-branches    - List available branches and their status

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('reset-staging', 'deploy-functions', 'list-branches')]
    [string]$Command,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('main', 'staging')]
    [string]$Branch = 'staging'
)

# Load environment variables
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "Could not find .env file"
    exit 1
}

$envContent = Get-Content $envFile
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match "(.+)=(.+)") {
        $envVars[$matches[1]] = $matches[2]
    }
}

# Required environment variables
$requiredVars = @(
    "SUPABASE_PROJECT_REF",
    "SUPABASE_PROJECT_DB_PASSWORD",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_URL"
)

foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var)) {
        Write-Error "Missing required environment variable: $var"
        exit 1
    }
}

$projectRef = $envVars["SUPABASE_PROJECT_REF"]
$dbPassword = $envVars["SUPABASE_PROJECT_DB_PASSWORD"]
$accessToken = $envVars["SUPABASE_ACCESS_TOKEN"]
$supabaseUrl = $envVars["SUPABASE_URL"]

# Database connection parameters
$dbHost = "$projectRef.supabase.co"
$dbPort = "5432"
$dbName = "postgres"
$dbUser = "postgres"

function Reset-StagingDatabase {
    Write-Host "Resetting staging database..."
    
    # Get staging database URL
    $stagingDbUrl = "postgresql://$dbUser`:$dbPassword@$dbHost`:$dbPort/$dbName?options=--branch=staging"
    
    # Reset database using Supabase CLI
    Write-Host "Running database reset..."
    $env:PGPASSWORD = $dbPassword
    supabase db reset --db-url $stagingDbUrl
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to reset staging database"
        exit 1
    }
    
    Write-Host "Staging database reset completed successfully"
}

function Deploy-Functions {
    param([string]$targetBranch)
    
    Write-Host "Deploying functions to $targetBranch branch..."
    
    # Use the project reference for both branches since they're the same project
    $projectId = $projectRef
    
    # Deploy each function
    Get-ChildItem -Path "functions" -Directory | ForEach-Object {
        $funcName = $_.Name
        if (Test-Path "$($_.FullName)/index.ts") {
            Write-Host "Deploying function: $funcName"
            supabase functions deploy $funcName --project-ref $projectId --branch $targetBranch
        }
    }
}

function List-Branches {
    Write-Host "Available branches:"
    Write-Host "------------------"
    Write-Host "main    - Production branch"
    Write-Host "staging - Staging/Testing branch"
    Write-Host ""
    Write-Host "Current branch status:"
    
    # Check main branch
    $mainDbUrl = "postgresql://$dbUser`:$dbPassword@$dbHost`:$dbPort/$dbName?options=--branch=main"
    $stagingDbUrl = "postgresql://$dbUser`:$dbPassword@$dbHost`:$dbPort/$dbName?options=--branch=staging"
    
    $env:PGPASSWORD = $dbPassword
    
    Write-Host "Main branch:"
    pg_isready -h $dbHost -p $dbPort -U $dbUser -d $dbName --options="--branch=main" | Out-String
    
    Write-Host "Staging branch:"
    pg_isready -h $dbHost -p $dbPort -U $dbUser -d $dbName --options="--branch=staging" | Out-String
}

# Execute the requested command
switch ($Command) {
    'reset-staging' {
        Reset-StagingDatabase
    }
    'deploy-functions' {
        Deploy-Functions -targetBranch $Branch
    }
    'list-branches' {
        List-Branches
    }
} 