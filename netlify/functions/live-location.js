/*
  ============================================================
  Netlify Function: live-location
  ============================================================
  Fetches a Garmin inReach MapShare "Raw KML Data" feed
  server-side (browsers can't do this directly — Garmin's
  server doesn't allow cross-origin requests from arbitrary
  websites), parses out the most recent position, and returns
  clean JSON for the map to consume.

  Required environment variable (set in Netlify site settings,
  NOT hardcoded here — keeps the feed URL out of public source):
    GARMIN_FEED_URL       e.g. https://share.garmin.com/Feed/Share/YourMapShareName

  Optional environment variable, only needed if the MapShare
  feed is password-protected:
    GARMIN_FEED_PASSWORD

  Response shape (200 OK):
    {
      "name": "Pete Streufert",
      "device": "inReach Messenger",
      "lat": 45.123,
      "lon": -113.456,
      "elevationMeters": 2100,
      "timestampUTC": "2026-09-14T18:32:00Z",
      "event": "" 
    }
  ============================================================
*/

exports.handler = async function () {
  const feedUrl = process.env.GARMIN_FEED_URL;

  if (!feedUrl) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GARMIN_FEED_URL is not set in Netlify environment variables.' }),
    };
  }

  // Append password if the feed is protected. NOTE: Garmin's exact mechanism
  // for password-protected feeds should be confirmed by testing against a
  // real protected feed — this appends it as a query param, the most common
  // pattern for share-link style APIs, adjust here if testing shows otherwise.
  let url = feedUrl;
  if (process.env.GARMIN_FEED_PASSWORD) {
    const sep = feedUrl.includes('?') ? '&' : '?';
    url = `${feedUrl}${sep}password=${encodeURIComponent(process.env.GARMIN_FEED_PASSWORD)}`;
  }

  let xml;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Garmin feed returned HTTP ${res.status}` }),
      };
    }
    xml = await res.text();
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to reach Garmin feed: ${err.message}` }),
    };
  }

  // Extract every <Placemark> block that contains a <Point> (the feed also
  // includes one Placemark with just a <LineString> track log — no ele/name/
  // timestamp on that one, so it's naturally skipped by the Point check).
  const placemarkBlocks = xml.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
  const points = [];

  for (const block of placemarkBlocks) {
    const pointMatch = block.match(/<Point>[\s\S]*?<coordinates>([^<]+)<\/coordinates>/);
    if (!pointMatch) continue;

    const [lon, lat, ele] = pointMatch[1].trim().split(',').map(Number);
    const whenMatch = block.match(/<when>([^<]+)<\/when>/);
    const nameMatch = block.match(/<name>([^<]*)<\/name>/);
    const deviceMatch = block.match(/<Data name="Device Type">\s*<value>([^<]*)<\/value>/);
    const eventMatch = block.match(/<Data name="Event">\s*<value>([^<]*)<\/value>/);

    if (!whenMatch || Number.isNaN(lat) || Number.isNaN(lon)) continue;

    points.push({
      lat,
      lon,
      elevationMeters: Number.isNaN(ele) ? null : ele,
      timestampUTC: whenMatch[1],
      name: nameMatch ? nameMatch[1] : 'Unknown',
      device: deviceMatch ? deviceMatch[1] : null,
      event: eventMatch ? eventMatch[1] : '',
    });
  }

  if (points.length === 0) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No position data found in the feed.' }),
    };
  }

  // Most recent ping wins, in case the feed has more than one point logged.
  points.sort((a, b) => new Date(b.timestampUTC) - new Date(a.timestampUTC));
  const latest = points[0];

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      // Cache briefly so a burst of page visits doesn't hammer Garmin's server.
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(latest),
  };
};
