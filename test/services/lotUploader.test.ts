import { describe, it, expect } from "vitest";
import {
  normName,
  pickDeterministic,
  indexVideosByName,
  matchPairs,
  targetNameSet,
  buildPairedVideoCreativeParams,
  buildAdBatchReqs,
  chunkAds,
  isRateLimit,
  TRANSIENT_RE,
  type PairTarget,
  type PairedAdSpec,
  type ReusedCopy,
} from "../../server/services/adsCreation/lotUploader";

describe("normName", () => {
  it("tira extensão, espaços e baixa caixa", () => {
    expect(normName("  Creator_Summit_React_Esther_h1b1c1_9x16.MP4 ")).toBe(
      "creator_summit_react_esther_h1b1c1_9x16",
    );
  });
  it("string vazia/nula vira vazio", () => {
    expect(normName("")).toBe("");
    expect(normName(undefined as any)).toBe("");
  });
});

describe("pickDeterministic", () => {
  it("escolhe o menor id de forma estável (independe da ordem)", () => {
    expect(pickDeterministic(["999", "111", "555"])).toBe("111");
    expect(pickDeterministic(["555", "111", "999"])).toBe("111");
  });
});

describe("indexVideosByName + matchPairs (match ESTRITO)", () => {
  // simula o Gerenciador com famílias parecidas que NÃO podem casar
  const videos = [
    { id: "a9", title: "Estrategia_peculiar_react_v2_Lucas_h1b1c1_9x16.mp4" },
    { id: "a4", title: "Estrategia_peculiar_react_v2_Lucas_h1b1c1_4x5.mp4" },
    // famílias que devem ser IGNORADAS:
    { id: "x1", title: "Estrategia_peculiar_react_Lucas_Hook1_9x16.mp4" }, // sem _v2
    { id: "x2", title: "creators_summit_lucas_h10_b1_c1_9x16.mp4" }, // h10/b1
    { id: "x3", title: "creators_summit_lucas_h1_b1_c1_4x5.mp4" }, // outro lote
    // duplicata legítima do mesmo arquivo:
    { id: "dupA", title: "Estrategia_peculiar_react_v2_Lucas_h2b1c1_4x5.mp4" },
    { id: "dupB", title: "Estrategia_peculiar_react_v2_Lucas_h2b1c1_4x5.mp4" },
    { id: "b9", title: "Estrategia_peculiar_react_v2_Lucas_h2b1c1_9x16.mp4" },
  ];
  const targets: PairTarget[] = [
    { key: "TP1740", base: "Estrategia_peculiar_react_v2_Lucas_h1b1c1" },
    { key: "TP1741", base: "Estrategia_peculiar_react_v2_Lucas_h2b1c1" },
    { key: "TP1742", base: "Estrategia_peculiar_react_v2_Lucas_h3b1c1" }, // não existe → faltando
  ];
  const pairs = matchPairs(targets, indexVideosByName(videos));

  it("casa só o nome EXATO, ignorando famílias parecidas (sem _v2, h10, outro lote)", () => {
    const p = pairs.get("TP1740")!;
    expect(p.v9).toBe("a9");
    expect(p.v4).toBe("a4");
    expect(p.dup9).toBe(1);
    expect(p.dup4).toBe(1);
  });

  it("detecta duplicata e escolhe id determinístico", () => {
    const p = pairs.get("TP1741")!;
    expect(p.v9).toBe("b9");
    expect(p.dup4).toBe(2); // dupA + dupB
    expect(p.v4).toBe("dupA"); // menor entre dupA/dupB
  });

  it("marca par faltando como undefined", () => {
    const p = pairs.get("TP1742")!;
    expect(p.v9).toBeUndefined();
    expect(p.v4).toBeUndefined();
    expect(p.dup9).toBe(0);
  });
});

describe("targetNameSet (early-exit)", () => {
  it("gera 2 nomes-alvo por par (9x16 + 4x5), normalizados", () => {
    const want = targetNameSet([{ key: "k", base: "Foo_Bar_h1b1c1" }]);
    expect(want.size).toBe(2);
    expect(want.has("foo_bar_h1b1c1_9x16")).toBe(true);
    expect(want.has("foo_bar_h1b1c1_4x5")).toBe(true);
  });
});

const COPY: ReusedCopy = {
  message: "corpo do anúncio",
  link: "https://pages.turbopartners.com.br/creators/",
  cta: "LEARN_MORE",
  urlTags: "utm_source=facebook",
  pageId: "111691498031338",
  ig: "17841423555147969",
};
const AD: PairedAdSpec = { tpId: "TP1740", finalName: "TP1740 - Foo", v9: "v9id", v45: "v4id" };

describe("buildPairedVideoCreativeParams", () => {
  it("monta asset_feed_spec pareado com 2 vídeos + regras por placement", () => {
    const c = buildPairedVideoCreativeParams(AD, COPY, new Map(), true);
    expect(c.asset_feed_spec.videos).toHaveLength(2);
    expect(c.asset_feed_spec.videos[0].video_id).toBe("v9id");
    expect(c.asset_feed_spec.videos[1].video_id).toBe("v4id");
    expect(c.asset_feed_spec.ad_formats).toEqual(["SINGLE_VIDEO"]);
    expect(c.asset_feed_spec.asset_customization_rules).toHaveLength(2);
    expect(c.object_story_spec.instagram_user_id).toBe(COPY.ig);
  });

  it("inclui thumbnail_url quando há thumb pré-buscada", () => {
    const thumbs = new Map<string, string | null>([["v9id", "https://thumb/9"], ["v4id", null]]);
    const c = buildPairedVideoCreativeParams(AD, COPY, thumbs, true);
    expect(c.asset_feed_spec.videos[0].thumbnail_url).toBe("https://thumb/9");
    expect(c.asset_feed_spec.videos[1].thumbnail_url).toBeUndefined(); // null → não envia
  });

  it("sem IG não inclui instagram_user_id (fallback FB-only)", () => {
    const c = buildPairedVideoCreativeParams(AD, COPY, new Map(), false);
    expect(c.object_story_spec.instagram_user_id).toBeUndefined();
    expect(c.object_story_spec.page_id).toBe(COPY.pageId);
  });
});

describe("buildAdBatchReqs", () => {
  const reqs = buildAdBatchReqs("act_123", "adset_9", [AD], COPY, new Map(), true);

  it("gera 2 sub-requests por ad (creative + ad)", () => {
    expect(reqs).toHaveLength(2);
    expect(reqs[0].relative_url).toBe("act_123/adcreatives");
    expect(reqs[1].relative_url).toBe("act_123/ads");
  });

  it("o ad depende do creative e referencia o id via {result=...}", () => {
    expect(reqs[1].depends_on).toBe(reqs[0].name);
    expect(reqs[1].body).toContain(`{result=${reqs[0].name}:$.id}`);
    expect(reqs[1].body).toContain("adset_id=adset_9");
    expect(reqs[1].body).toContain("status=PAUSED");
  });

  it("offset mantém nomes únicos ao chunkar", () => {
    const r2 = buildAdBatchReqs("act_123", "adset_9", [AD], COPY, new Map(), true, 25);
    expect(r2[0].name).toBe("creative_25");
    expect(r2[1].name).toBe("ad_25");
  });
});

describe("chunkAds", () => {
  it("quebra em chunks de no máx 25 ads (≤50 sub-requests)", () => {
    const ads = Array.from({ length: 60 }, (_, i) => i);
    const chunks = chunkAds(ads, 25);
    expect(chunks.map((c) => c.length)).toEqual([25, 25, 10]);
  });
  it("lista pequena = 1 chunk", () => {
    expect(chunkAds([1, 2, 3], 25)).toHaveLength(1);
  });
});

describe("isRateLimit / TRANSIENT_RE", () => {
  it("reconhece rate-limit duro", () => {
    expect(isRateLimit(new Error("Meta API ... (code=80004): ..."))).toBe(true);
    expect(isRateLimit(new Error("too many calls"))).toBe(true);
    expect(isRateLimit(new Error("erro qualquer"))).toBe(false);
  });
  it("reconhece o erro transitório de thumbnail (o que tomamos hoje)", () => {
    expect(TRANSIENT_RE.test("There was a problem uploading your video thumbnail. Please try again.")).toBe(true);
    expect(TRANSIENT_RE.test("Something went wrong. Please try again later")).toBe(true);
    expect(TRANSIENT_RE.test("Invalid parameter")).toBe(false);
  });
});
