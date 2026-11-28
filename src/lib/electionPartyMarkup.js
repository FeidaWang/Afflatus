import { displayPartyId, partyIconsFor } from './electionRules.js';

function renderPartyIcons(icons, size) {
  if (!icons.length) return '';
  const imgs = icons.map((icon) => (icon.dot ? `<i class="el-party-dot" style="background:${icon.dot}"></i>` : `<img class="el-party-icon${icon.wide ? ' is-wide' : ''}"${icon.bg ? ` style="background:${icon.bg}"` : ''} src="${icon.src}" alt="" width="${icon.width}" height="${icon.height}" decoding="async">`)).join('');
  return `<span class="el-party-badge el-party-badge-${size}${icons.length > 1 ? ' is-pair' : ''}" aria-hidden="true">${imgs}</span>`;
}

export const renderPartyBadge = (family, partyId, size = 'md') => renderPartyIcons(partyIconsFor(family, partyId), size);
export const renderCandidatePartyBadge = (family, candidate, size = 'sm') => renderPartyIcons(partyIconsFor(family, displayPartyId(candidate), candidate?.party, candidate?.independent), size);
