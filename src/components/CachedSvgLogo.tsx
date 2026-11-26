import React, { useEffect, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

const SVG_CACHE_LIMIT = 160;
const svgCache = new Map<string, string>();
const svgRequests = new Map<string, Promise<string | null>>();

function rememberSvg(uri: string, xml: string) {
  svgCache.delete(uri);
  svgCache.set(uri, xml);
  if (svgCache.size > SVG_CACHE_LIMIT) {
    const oldestKey = svgCache.keys().next().value;
    if (oldestKey) svgCache.delete(oldestKey);
  }
}

async function loadSvg(uri: string): Promise<string | null> {
  const cached = svgCache.get(uri);
  if (cached) {
    // Refresh insertion order so frequently viewed logos remain in the bounded cache.
    rememberSvg(uri, cached);
    return cached;
  }
  const pending = svgRequests.get(uri);
  if (pending) return pending;

  const request = fetch(uri, { headers: { Accept: 'image/svg+xml,application/xml;q=0.9,*/*;q=0.5' } })
    .then(async (response) => {
      if (!response.ok) return null;
      const xml = await response.text();
      if (!/<svg[\s>]/i.test(xml)) return null;
      rememberSvg(uri, xml);
      return xml;
    })
    .catch(() => null)
    .finally(() => svgRequests.delete(uri));
  svgRequests.set(uri, request);
  return request;
}

export function CachedSvgLogo({
  uri,
  width,
  height,
  style,
}: {
  uri: string;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [loadedSvg, setLoadedSvg] = useState<{ uri: string; xml: string | null }>(() => ({ uri, xml: svgCache.get(uri) || null }));

  useEffect(() => {
    let mounted = true;
    if (!/^https:\/\//i.test(uri)) return () => { mounted = false; };
    void loadSvg(uri).then((value) => {
      if (mounted) setLoadedSvg({ uri, xml: value });
    });
    return () => { mounted = false; };
  }, [uri]);

  const xml = loadedSvg.uri === uri ? loadedSvg.xml : null;

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
      {xml ? <SvgXml xml={xml} width={width} height={height} /> : null}
    </View>
  );
}
