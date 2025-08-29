// Hue Bridge Management API (v2 bridge resource wrapper)

export interface HueBridgeEntry {
  ip: string;
  hueUser: string;
  hueClientKey?: string;
  name?: string;
}

async function getBridgeResourceId(): Promise<string> {
  const res = await fetch('/clip/v2/resource/bridge');
  const data = await res.json();
  const id = data?.data?.[0]?.id;
  if (!id) throw new Error('Bridge resource id not found');
  return id;
}

export async function listBridges(): Promise<HueBridgeEntry[]> {
  const id = await getBridgeResourceId();
  const res = await fetch(`/clip/v2/resource/bridge/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hue: { type: 'hue', action: 'list' } }),
  });
  const body = await res.json();
  return body?.data?.[0]?.bridges || [];
}

export async function pairBridge(ip: string, name?: string, devicetype?: string): Promise<{ paired: boolean; hueUser?: string; hueClientKey?: string; needsLinkButton?: boolean; message?: string; }>{
  const id = await getBridgeResourceId();
  const res = await fetch(`/clip/v2/resource/bridge/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hue: { type: 'hue', action: 'pair', ip, name, devicetype } }),
  });
  const body = await res.json();
  if (res.status === 202) {
    const msg = body?.errors?.[0]?.description || 'Press the link button on the Hue bridge and try again';
    return { paired: false, needsLinkButton: true, message: msg };
  }
  if (!res.ok) {
    return { paired: false, message: body?.errors?.[0]?.description || `HTTP ${res.status}` };
  }
  const d = body?.data?.[0];
  return { paired: !!d?.paired, hueUser: d?.hueUser, hueClientKey: d?.hueClientKey };
}

export async function importLights(ip: string): Promise<number> {
  const id = await getBridgeResourceId();
  const res = await fetch(`/clip/v2/resource/bridge/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hue: { type: 'hue', action: 'import_lights', ip } }),
  });
  const body = await res.json();
  return body?.data?.[0]?.imported ?? 0;
}

export async function removeBridge(ip: string, pruneLights = false): Promise<boolean> {
  const id = await getBridgeResourceId();
  const res = await fetch(`/clip/v2/resource/bridge/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hue: { type: 'hue', action: 'remove', ip, prune_lights: pruneLights } }),
  });
  return res.ok;
}

export async function scanHueBridges(): Promise<Array<{ id?: string; ip: string }>> {
  // Use the public Hue discovery. If blocked by CORS, UI should fallback to manual input.
  try {
    const resp = await fetch('https://discovery.meethue.com/');
    const arr = await resp.json();
    return (arr || []).map((b: any) => ({ id: b.id, ip: b.internalipaddress }));
  } catch {
    return [];
  }
}

export default {
  listBridges,
  pairBridge,
  importLights,
  removeBridge,
  scanHueBridges,
};

