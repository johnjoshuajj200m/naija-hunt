/** Play mode lives in the query string, so refresh and a direct link need no router. */

export type PlayQuery = { playing: boolean; overview: boolean; fresh: boolean };

export function readPlayQuery(search: string): PlayQuery {
  const params = new URLSearchParams(search);
  return {
    playing: params.get("play") === "1",
    overview: params.get("view") === "overview",
    fresh: params.get("new") === "1",
  };
}

/** Keeps unrelated parameters such as `stats` and `view`. Drops `new` so a refresh does not reset again. */
export function playPath(playing: boolean, href: string): string {
  const url = new URL(href, "http://localhost");
  if (playing) {
    url.searchParams.set("play", "1");
  } else {
    url.searchParams.delete("play");
    url.searchParams.delete("at");
  }
  url.searchParams.delete("new");
  return `${url.pathname}${url.search}`;
}
