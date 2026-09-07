# Deploy the course to Azure App Service

This repository builds a Node.js server with Vinext. `npm start` runs `vinext start`, which listens on `0.0.0.0` and reads Azure's `PORT`. No database or GPU is required. Learner notes and progress remain in browser localStorage.

The supplied GitHub Actions workflow builds on Linux using Node 24 and pnpm 11.19.0. It packages the server, browser assets, public downloads and Linux dependencies, checks the packaged server, then deploys using OpenID Connect (OIDC). It does not need a publish-profile password.

## 1. Create the Web App

In Azure Portal, create **App Service → Web App**:

- Publish: **Code**.
- Operating system: **Linux**.
- Runtime: **Node 24 LTS**, matching the workflow.
- Choose a region and an App Service Plan appropriate to your budget. Review the displayed cost before creating it.
- Choose a unique application name and record its resource group.
- Leave automated Deployment Center workflow creation disabled: this repository already includes `.github/workflows/azure-app-service.yml`.

In the Web App settings:

| Setting | Value |
| --- | --- |
| Startup command (Configuration / General settings or Stack settings) | `npm start` |
| Environment variable `NODE_ENV` | `production` |
| Environment variable `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` |

GitHub builds the application and includes dependencies; Azure should not rebuild the deployment package. Allow Azure to supply `PORT`; do not use the local development port 8787. Enable HTTPS Only, and optionally Always On if your plan supports it.

## 2. Authorize this GitHub repository

Open **Azure Cloud Shell → Bash**. Replace the three values below with the subscription ID, resource group and Web App name from Azure. These commands create an identity and grant it deployment access to this Web App only. Your Azure account needs permission to create an Entra app registration and assign this role; if it does not, ask your subscription administrator to perform this step.

```bash
set -euo pipefail
subscription_id='YOUR_SUBSCRIPTION_ID'
resource_group='YOUR_RESOURCE_GROUP'
webapp_name='YOUR_WEB_APP_NAME'

az account set --subscription "$subscription_id"
app_scope=$(az webapp show --resource-group "$resource_group" --name "$webapp_name" --query id -o tsv)
client_id=$(az ad app create --display-name "$webapp_name-github-deploy" --query appId -o tsv)
principal_id=$(az ad sp create --id "$client_id" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$principal_id" \
  --assignee-principal-type ServicePrincipal \
  --role 'Website Contributor' \
  --scope "$app_scope"

az ad app federated-credential create --id "$client_id" --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:github4me/ai-learning:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

echo "AZURE_CLIENT_ID=$client_id"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$subscription_id"
```

Record the returned IDs. Run this identity-creation block once; do not create another app registration every time you deploy. No client secret is generated. The federated subject permits deployments from this repository's `main` branch. If you later change the repository, branch or add a GitHub environment to the deploy job, update the subject accordingly.

## 3. Add GitHub settings

Open **github4me/ai-learning → Settings → Secrets and variables → Actions**.

Under **Secrets**, add these repository secrets using the IDs above:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Under **Variables**, add this repository variable:

- `AZURE_WEBAPP_NAME`: the exact Web App name from Azure (not its URL).

Without `AZURE_WEBAPP_NAME`, the workflow builds but skips deployment. Add the variable after configuring the identity and secrets.

## 4. Deploy

In GitHub, open **Actions → Deploy course to Azure App Service → Run workflow**, select **main**, then run it. Future pushes to `main` trigger the same workflow.

After the build and deploy jobs succeed, open the Web App's **Overview → Default domain** in Azure. Use that exact HTTPS address, since Azure may include a generated suffix in the hostname.

Check the homepage, a deep link such as `/week/week-06`, search, and `/downloads/course-examples.zip`. Existing notes under your local IP do not automatically appear at the new domain; export them from the old site and import them on the published site.

## Troubleshooting

- **Deploy skipped:** set the repository variable `AZURE_WEBAPP_NAME` and run on `main`.
- **OIDC login failed:** check the three IDs, the exact federated subject and the workflow's `id-token: write` permission.
- **Deployment forbidden:** verify the identity's Website Contributor assignment on the correct Web App. New role assignments may take time to propagate.
- **Build failed:** read the first failing GitHub Actions step. The workflow includes content validation and does not bypass failures.
- **Application Error / 503:** open Azure **Log stream**. Check Linux/Node 24, startup command `npm start`, and deployment package contents. The package must contain `dist`, `public`, `node_modules` and `package.json` at its root.
- **Old content:** confirm the latest run succeeded and deployed the intended commit. Keep only this deployment workflow enabled for the app.

The package deliberately includes build-time dependencies as well as runtime dependencies to preserve the current Vinext dependency graph. It is larger than a minimized artifact. GitHub installs dependencies on Linux with a hoisted layout; do not replace them with a Windows `node_modules` directory.

## Local production preview

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The default local production port is 3000. In PowerShell, set `$env:PORT='8791'` before starting if you want a separate production preview while the development server is running.

Official reference: [Deploy to Azure App Service using GitHub Actions](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions).
