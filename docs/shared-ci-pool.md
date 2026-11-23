# Shared homelab build pool

Trusted main-branch builds use repository-scoped runner `gha-personal-build` with label `homelab-personal-build`. It shares compute with wedding CI but has its own non-sudo Unix account, private installation/work directories, and runner registration. Runner directories are not readable across the two service accounts. No Docker socket or administrator group is granted.

Public pull-request validation remains GitHub-hosted. Non-main manual deploy-workflow builds also remain hosted. The GitHub Pages dev publisher and Cloudflare production deploy job run on GitHub-hosted runners. Both publish build artifacts through their own deployment environments. No additional VM or firewall change is required.

System browser dependencies are provisioned on the host; the unprivileged self-hosted job installs Chromium without sudo. Hosted jobs install their own system dependencies. Shared compute does not provide VM-level isolation between trusted projects; a compromised kernel or resource exhaustion can affect both. Do not add untrusted PR workloads to this pool.

## Rollback
Revert the workflow change to return the build to hosted Ubuntu. Wait for any active job to finish before stopping/removing only the personal runner service and registration. Leave wedding build/deployment services intact. Keep approved private directory permissions unless separately authorized to change them.
