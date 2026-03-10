export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

export function addReferralParam(url, refValue = 'humane.directory') {
  try {
    const outboundUrl = new URL(url);
    outboundUrl.searchParams.append('ref', refValue);
    return outboundUrl.toString();
  } catch (error) {
    return url;
  }
}
