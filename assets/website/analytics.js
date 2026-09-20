(function () {
  'use strict';

  const MIXPANEL_TOKEN = '2f63eedf67ab2c69fa541e6c3a737fae';
  const MIXPANEL_ENDPOINT = 'https://api-eu.mixpanel.com/track?ip=0&verbose=1';
  const CONSENT_KEY = 'vyenne:website_analytics_consent_v1';
  const VISITOR_KEY = 'vyenne:website_analytics_id_v1';
  const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  const IS_LIVE_SITE = /(^|\.)vyenne\.com$/i.test(window.location.hostname);
  const sessionId = uuid();
  let visitorId = null;
  let pageViewSent = false;

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // A private browser may block storage. The choice still applies to this page load.
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing else to clear.
    }
  }

  function readChoice() {
    const stored = storageGet(CONSENT_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      if (
        (parsed.choice === 'granted' || parsed.choice === 'denied') &&
        typeof parsed.at === 'number' &&
        Date.now() - parsed.at < CONSENT_MAX_AGE_MS
      ) {
        return parsed.choice;
      }
    } catch {
      // Replace malformed or old preferences with a fresh choice.
    }
    storageRemove(CONSENT_KEY);
    storageRemove(VISITOR_KEY);
    return null;
  }

  function writeChoice(choice) {
    storageSet(CONSENT_KEY, JSON.stringify({ choice, at: Date.now() }));
  }

  function getVisitorId() {
    if (visitorId) return visitorId;
    const stored = storageGet(VISITOR_KEY);
    visitorId = /^[0-9a-f-]{36}$/i.test(stored || '') ? stored : uuid();
    storageSet(VISITOR_KEY, visitorId);
    return visitorId;
  }

  function safeCampaignValue(value) {
    if (!value) return undefined;
    const cleaned = value.replace(/[^a-z0-9 ._~-]/gi, '').trim();
    return cleaned ? cleaned.slice(0, 80) : undefined;
  }

  function pageName() {
    const name = window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    if (name === 'privacy.html') return 'privacy';
    if (name === 'terms.html') return 'terms';
    if (name === 'code-of-conduct.html') return 'code_of_conduct';
    return 'home';
  }

  function referrerDomain() {
    if (!document.referrer) return undefined;
    try {
      const domain = new URL(document.referrer).hostname.toLowerCase();
      return domain && domain !== window.location.hostname.toLowerCase()
        ? domain.slice(0, 96)
        : undefined;
    } catch {
      return undefined;
    }
  }

  function send(event, properties) {
    if (!IS_LIVE_SITE || readChoice() !== 'granted') return;
    const id = getVisitorId();
    const payload = {
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: id,
        $device_id: id,
        $insert_id: uuid(),
        time: Math.floor(Date.now() / 1000),
        session_id: sessionId,
        platform: 'website',
        ...properties
      }
    };
    fetch(MIXPANEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([payload]),
      keepalive: true
    }).catch(function () {
      // Analytics must never interrupt the page.
    });
  }

  function trackPageView() {
    if (pageViewSent) return;
    pageViewSent = true;
    const params = new URLSearchParams(window.location.search);
    send('website_viewed', {
      website_page: pageName(),
      referrer_domain: referrerDomain(),
      utm_source: safeCampaignValue(params.get('utm_source')),
      utm_medium: safeCampaignValue(params.get('utm_medium')),
      utm_campaign: safeCampaignValue(params.get('utm_campaign'))
    });
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .vy-analytics {
        position: fixed; z-index: 2147483646; left: 16px; right: 16px; bottom: 16px;
        max-width: 560px; margin: 0 auto; padding: 20px;
        color: #ede8f5; background: rgba(30, 22, 40, .98);
        border: 1px solid rgba(176, 157, 216, .18); border-radius: 18px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, .42);
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .vy-analytics[hidden] { display: none; }
      .vy-analytics h2 {
        margin: 0 0 6px; color: #ede8f5;
        font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-style: italic;
        font-weight: 600; line-height: 23px; letter-spacing: 0;
      }
      .vy-analytics p {
        margin: 0; color: #a89ac6;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; font-style: normal; font-weight: 400; line-height: 19px;
      }
      .vy-analytics p a { color: #ccb8ec; }
      .vy-analytics__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .vy-analytics button, [data-vy-analytics-settings] {
        min-height: 44px; border-radius: 16px; padding: 0 16px; cursor: pointer;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; font-style: normal; font-weight: 600; line-height: 1;
      }
      .vy-analytics button:focus-visible, [data-vy-analytics-settings]:focus-visible {
        outline: 3px solid rgba(176, 157, 216, .55); outline-offset: 2px;
      }
      .vy-analytics__allow { border: 1px solid #b09dd8; background: #b09dd8; color: #1e1628; }
      .vy-analytics__decline { border: 1px solid rgba(176, 157, 216, .35); background: transparent; color: #ede8f5; }
      [data-vy-analytics-settings] {
        margin-top: 8px; border: 1px solid #d8c6ee; background: #fff; color: #6a5880;
      }
      @media (min-width: 620px) {
        .vy-analytics { display: flex; align-items: center; gap: 22px; }
        .vy-analytics__actions { flex: none; margin-top: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeDialog() {
    const dialog = document.createElement('aside');
    dialog.className = 'vy-analytics';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-labelledby', 'vy-analytics-title');
    dialog.setAttribute('aria-describedby', 'vy-analytics-copy');
    dialog.innerHTML = `
      <div>
        <h2 id="vy-analytics-title">Website analytics</h2>
        <p id="vy-analytics-copy">Allow website analytics to count visits, referral sources and App Store taps. No names or advertising tracking. <a href="./privacy.html#website-analytics">Privacy</a></p>
      </div>
      <div class="vy-analytics__actions">
        <button class="vy-analytics__allow" type="button">Allow</button>
        <button class="vy-analytics__decline" type="button">No thanks</button>
      </div>
    `;
    dialog.querySelector('.vy-analytics__allow').addEventListener('click', function () {
      writeChoice('granted');
      dialog.hidden = true;
      trackPageView();
    });
    dialog.querySelector('.vy-analytics__decline').addEventListener('click', function () {
      writeChoice('denied');
      visitorId = null;
      storageRemove(VISITOR_KEY);
      dialog.hidden = true;
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function boot() {
    addStyles();
    const dialog = makeDialog();
    const choice = readChoice();
    if (choice === 'granted') trackPageView();
    if (!choice) dialog.hidden = false;

    document.querySelectorAll('[data-vy-analytics-settings]').forEach(function (button) {
      button.hidden = false;
      button.addEventListener('click', function () {
        dialog.hidden = false;
        dialog.querySelector('.vy-analytics__allow').focus();
      });
    });

    document.querySelectorAll('a.appstore').forEach(function (link) {
      link.addEventListener('click', function () {
        send('website_app_store_tapped', {
          website_page: pageName(),
          placement: link.closest('.hero') ? 'hero' : 'download'
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
