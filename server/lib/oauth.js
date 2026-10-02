'use strict';
// OAuth-ready architecture (Spec §77). Providers are declared here but stay
// disabled until credentials are supplied via environment variables — no
// credential ever reaches the frontend, and no external call is made until a
// provider is actually configured.
const PROVIDERS = {
  google: { id: 'google', name: 'Google', env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  apple: { id: 'apple', name: 'Apple', env: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'] },
  wechat: { id: 'wechat', name: 'WeChat', env: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'] },
};

function list() {
  return Object.keys(PROVIDERS).map((id) => {
    const p = PROVIDERS[id];
    return { id: p.id, name: p.name, enabled: p.env.every((k) => !!process.env[k]) };
  });
}
function begin(id) {
  const p = PROVIDERS[id];
  if (!p) return { error: 'UNKNOWN_PROVIDER' };
  if (!p.env.every((k) => !!process.env[k])) return { error: 'PROVIDER_DISABLED' };
  // A configured provider would build its authorize URL here. Kept inert until configured.
  return { error: 'NOT_IMPLEMENTED' };
}

module.exports = { PROVIDERS, list, begin };
