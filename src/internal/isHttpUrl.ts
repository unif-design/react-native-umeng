function isIpv6Address(input: string): boolean {
  let address = input;
  const lastColon = address.lastIndexOf(':');
  const finalPart = address.slice(lastColon + 1);
  if (finalPart.includes('.')) {
    const octets = finalPart.split('.');
    if (
      octets.length !== 4 ||
      !octets.every(
        (octet) => /^(0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255
      )
    )
      return false;
    address = `${address.slice(0, lastColon + 1)}0:0`;
  }
  const halves = address.split('::');
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => (half ? half.split(':') : []));
  return (
    groups.every((group) => /^[\da-f]{1,4}$/i.test(group)) &&
    (halves.length === 2 ? groups.length < 8 : groups.length === 8)
  );
}

function isValidAuthority(authority: string): boolean {
  if (
    /\s|\\/.test(authority) ||
    Array.from(authority).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  )
    return false;

  const hostAndPort = authority.slice(authority.lastIndexOf('@') + 1);
  const bracketed = hostAndPort.startsWith('[');
  const parts = bracketed
    ? /^\[([^\]]+)\](?::(\d*))?$/.exec(hostAndPort)
    : /^([^:]+)(?::(\d*))?$/.exec(hostAndPort);
  if (!parts?.[1]) return false;
  const [, host, port] = parts;
  if (port !== undefined && Number(port) > 65535) return false;
  if (bracketed) return isIpv6Address(host);

  try {
    const decodedHost = decodeURIComponent(host);
    return (
      decodedHost.length > 0 &&
      !/\s/.test(decodedHost) &&
      !Array.from(decodedHost).some(
        (character) =>
          character.charCodeAt(0) < 32 ||
          character.charCodeAt(0) === 127 ||
          '%#/:<>?@[\\]^|'.includes(character)
      )
    );
  } catch {
    return false;
  }
}

export function isHttpUrl(value: string): boolean {
  // React Native's URL constructor does not validate the host or port.
  const authority = /^https?:\/\/([^/?#]+)/i.exec(value)?.[1];
  if (!authority || !isValidAuthority(authority)) return false;
  try {
    const parsed = new URL(
      value.replace(/^https?:/i, (scheme) => scheme.toLowerCase())
    );
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}
