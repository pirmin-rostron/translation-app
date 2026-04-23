// Data fixtures — projects, documents, jobs, plus cross-cutting review blocks, activity, attention queue.

window.HELVARA_DATA = (function () {
  const projects = [
    {
      id: 1,
      name: "Nova Launch — Spring Campaign",
      description: "Hero site copy, press release, and product one-pager for the Nova headphones launch across Spanish-speaking markets.",
      due_date: "2026-05-04",
      target_languages: ["es-ES", "es-MX", "fr-FR"],
      pinned: true,
      document_count: 4,
      stats: { total_jobs: 12, completed_count: 7, in_review_count: 3, total_words: 18420 },
      documents: [
        {
          id: 101, name: "nova-hero-copy.docx", words: 612, uploaded: "2026-04-14",
          jobs: [
            { id: 1001, source: "en", target: "es-ES", status: "in_review", ambiguities: 2, insights: 14, progress: 100, autopilot: true },
            { id: 1002, source: "en", target: "es-MX", status: "completed", ambiguities: 0, insights: 16, progress: 100, autopilot: true },
            { id: 1003, source: "en", target: "fr-FR", status: "processing", ambiguities: 0, insights: 0, progress: 64, autopilot: true },
          ],
        },
        {
          id: 102, name: "nova-press-release.rtf", words: 921, uploaded: "2026-04-15",
          jobs: [
            { id: 1004, source: "en", target: "es-ES", status: "in_review", ambiguities: 4, insights: 22, progress: 100, autopilot: true },
            { id: 1005, source: "en", target: "es-MX", status: "in_review", ambiguities: 1, insights: 19, progress: 100, autopilot: true },
            { id: 1006, source: "en", target: "fr-FR", status: "processing", ambiguities: 0, insights: 0, progress: 28, autopilot: true },
          ],
        },
        {
          id: 103, name: "nova-product-onepager.docx", words: 340, uploaded: "2026-04-16",
          jobs: [
            { id: 1007, source: "en", target: "es-ES", status: "completed", ambiguities: 0, insights: 9, progress: 100, autopilot: true },
            { id: 1008, source: "en", target: "es-MX", status: "exported", ambiguities: 0, insights: 11, progress: 100, autopilot: true },
            { id: 1009, source: "en", target: "fr-FR", status: "completed", ambiguities: 0, insights: 10, progress: 100, autopilot: true },
          ],
        },
        {
          id: 104, name: "nova-email-announce.txt", words: 280, uploaded: "2026-04-18",
          jobs: [
            { id: 1010, source: "en", target: "es-ES", status: "completed", ambiguities: 0, insights: 6, progress: 100, autopilot: true },
            { id: 1011, source: "en", target: "es-MX", status: "completed", ambiguities: 0, insights: 7, progress: 100, autopilot: true },
            { id: 1012, source: "en", target: "fr-FR", status: "pending", ambiguities: 0, insights: 0, progress: 0, autopilot: true },
          ],
        },
      ],
    },
    {
      id: 2, name: "Atlas — Quarterly Newsletter",
      description: "Customer-facing newsletter; high-stakes brand voice. Glossary-heavy.",
      due_date: "2026-04-28", target_languages: ["es-ES", "de-DE"], pinned: true,
      document_count: 2, stats: { total_jobs: 4, completed_count: 1, in_review_count: 2, total_words: 4220 },
      documents: [
        {
          id: 201, name: "atlas-newsletter-q2.docx", words: 2840, uploaded: "2026-04-20",
          jobs: [
            { id: 2001, source: "en", target: "es-ES", status: "in_review", ambiguities: 3, insights: 18, progress: 100, autopilot: true },
            { id: 2002, source: "en", target: "de-DE", status: "in_review", ambiguities: 2, insights: 15, progress: 100, autopilot: true },
          ],
        },
        {
          id: 202, name: "atlas-footer-copy.txt", words: 1380, uploaded: "2026-04-21",
          jobs: [
            { id: 2003, source: "en", target: "es-ES", status: "completed", ambiguities: 0, insights: 6, progress: 100, autopilot: true },
            { id: 2004, source: "en", target: "de-DE", status: "processing", ambiguities: 0, insights: 0, progress: 42, autopilot: true },
          ],
        },
      ],
    },
    {
      id: 3, name: "Harbor App — Onboarding Strings",
      description: "Mobile onboarding copy and tooltips. Short-form, high frequency glossary terms.",
      due_date: "2026-06-12", target_languages: ["es-ES", "es-MX", "fr-FR", "pt-BR"], pinned: false,
      document_count: 1, stats: { total_jobs: 4, completed_count: 0, in_review_count: 0, total_words: 1180 },
      documents: [
        {
          id: 301, name: "onboarding-strings.docx", words: 1180, uploaded: "2026-04-21",
          jobs: [
            { id: 3001, source: "en", target: "es-ES", status: "processing", ambiguities: 0, insights: 0, progress: 72, autopilot: true },
            { id: 3002, source: "en", target: "es-MX", status: "processing", ambiguities: 0, insights: 0, progress: 68, autopilot: true },
            { id: 3003, source: "en", target: "fr-FR", status: "processing", ambiguities: 0, insights: 0, progress: 54, autopilot: true },
            { id: 3004, source: "en", target: "pt-BR", status: "pending",    ambiguities: 0, insights: 0, progress: 0,  autopilot: true },
          ],
        },
      ],
    },
    {
      id: 4, name: "Legal — MSA Templates 2026",
      description: "Master service agreement base template and three client variants.",
      due_date: null, target_languages: ["es-ES", "de-DE", "fr-FR"], pinned: false,
      document_count: 0, stats: { total_jobs: 0, completed_count: 0, in_review_count: 0, total_words: 0 },
      documents: [],
    },
    {
      id: 5, name: "Meridian — Investor Update Q1",
      description: "",
      due_date: "2026-04-24", target_languages: ["es-ES"], pinned: false,
      document_count: 1, stats: { total_jobs: 1, completed_count: 1, in_review_count: 0, total_words: 2140 },
      documents: [
        {
          id: 501, name: "meridian-q1-update.docx", words: 2140, uploaded: "2026-04-12",
          jobs: [
            { id: 5001, source: "en", target: "es-ES", status: "exported", ambiguities: 0, insights: 12, progress: 100, autopilot: true },
          ],
        },
      ],
    },
  ];

  // Attention queue — blocks flagged for review across all projects
  const attention = [
    { id: "a1", projectId: 1, projectName: "Nova Launch — Spring Campaign", document: "nova-press-release.rtf", job: 1004, pair: "EN → ES", kind: "ambiguity", count: 4, age: "2h ago" },
    { id: "a2", projectId: 1, projectName: "Nova Launch — Spring Campaign", document: "nova-hero-copy.docx", job: 1001, pair: "EN → ES", kind: "ambiguity", count: 2, age: "4h ago" },
    { id: "a3", projectId: 2, projectName: "Atlas — Quarterly Newsletter", document: "atlas-newsletter-q2.docx", job: 2001, pair: "EN → ES", kind: "ambiguity", count: 3, age: "today" },
    { id: "a4", projectId: 2, projectName: "Atlas — Quarterly Newsletter", document: "atlas-newsletter-q2.docx", job: 2002, pair: "EN → DE", kind: "ambiguity", count: 2, age: "today" },
    { id: "a5", projectId: 1, projectName: "Nova Launch — Spring Campaign", document: "nova-press-release.rtf", job: 1005, pair: "EN → MX", kind: "glossary", count: 1, age: "yesterday" },
  ];

  // Recent activity — past 24h
  const activity = [
    { id: "e1", when: "12 min ago", icon: "✓", tone: "success", text: "nova-email-announce.txt · EN→ES marked Completed", meta: "Autopilot" },
    { id: "e2", when: "47 min ago", icon: "⚡", tone: "accent",  text: "4 ambiguities flagged in nova-press-release.rtf · EN→ES", meta: "Needs review" },
    { id: "e3", when: "1h ago",     icon: "◈", tone: "accent",  text: "92% memory match applied to 14 blocks in Atlas newsletter", meta: "Linguistic insight" },
    { id: "e4", when: "3h ago",     icon: "↑", tone: "muted",   text: "nova-blog-post.docx uploaded to Nova Launch", meta: "Queued for 3 languages" },
    { id: "e5", when: "5h ago",     icon: "✓", tone: "success", text: "meridian-q1-update.docx exported", meta: "DOCX" },
    { id: "e6", when: "yesterday",  icon: "+", tone: "muted",   text: "Atlas — Quarterly Newsletter created", meta: "2 target languages" },
  ];

  // Autopilot live status — jobs currently running
  const autopilotRunning = [
    { id: 1003, file: "nova-hero-copy.docx",       pair: "EN → FR", progress: 64, eta: "~2 min" },
    { id: 1006, file: "nova-press-release.rtf",     pair: "EN → FR", progress: 28, eta: "~5 min" },
    { id: 2004, file: "atlas-footer-copy.txt",      pair: "EN → DE", progress: 42, eta: "~3 min" },
    { id: 3001, file: "onboarding-strings.docx",    pair: "EN → ES", progress: 72, eta: "~90s" },
    { id: 3002, file: "onboarding-strings.docx",    pair: "EN → MX", progress: 68, eta: "~2 min" },
  ];

  // Autopilot — agent persona + running tasks
  const autopilot = {
    agent: {
      name: "Rumi",
      role: "Autopilot",
      tagline: "Your in-house linguist, working around the clock",
      status: "active", // active | paused | idle
      avatar_bg: "linear-gradient(135deg, #0D7B6E 0%, #5B2B5F 100%)",
      initials: "R",
      stats_today: {
        blocks_translated: 1284,
        insights_raised: 42,
        decisions_auto: 1211,
        decisions_asking: 11,
        saved_minutes: 187,
      },
    },
    // Agent messages — stream of decisions, questions, and completions
    messages: [
      {
        id: "m1", when: "3 min ago", kind: "question",
        project: "Nova Launch", document: "nova-press-release.rtf", pair: "EN → ES", jobId: 1004,
        title: "2 genuine ambiguities in the press release — your call?",
        body: "I finished the translation but stopped short on two lines where the register could go editorial or stay closer to the source. I've picked a leading option but want your eyes.",
        actions: [{ label: "Open review", primary: true, jobId: 1004 }, { label: "Trust my picks", primary: false }],
      },
      {
        id: "m2", when: "8 min ago", kind: "completed",
        project: "Nova Launch", document: "nova-email-announce.txt", pair: "EN → ES", jobId: 1010,
        title: "Shipped nova-email-announce.txt — EN→ES",
        body: "Clean run. 14 blocks, 6 memory matches at 90%+, zero ambiguities flagged. Ready to export.",
        meta: "124 words · 0:32",
      },
      {
        id: "m3", when: "22 min ago", kind: "decision",
        project: "Atlas Newsletter", document: "atlas-newsletter-q2.docx", pair: "EN → ES", jobId: 2001,
        title: "Used 'lanzamiento' (not 'estreno') for 'launch' — 14 places",
        body: "Your glossary prefers 'lanzamiento' for product launches in Atlas contexts. I'm applying it consistently. Let me know if this campaign should read differently.",
        meta: "Glossary · applied",
      },
      {
        id: "m4", when: "41 min ago", kind: "question",
        project: "Atlas Newsletter", document: "atlas-newsletter-q2.docx", pair: "EN → DE", jobId: 2002,
        title: "\"Partner\" reads ambiguously in German here",
        body: "In the intro paragraph, 'our partners' could be business (Geschäftspartner) or customers (Kunden) depending on audience. Memory is split 60/40. Mind deciding?",
        actions: [{ label: "Open review", primary: true, jobId: 2002 }],
      },
      {
        id: "m5", when: "1h ago", kind: "decision",
        project: "Nova Launch", document: "nova-product-onepager.docx", pair: "EN → MX",
        title: "Swapped 'carga rápida' to 'carga en diez minutos'",
        body: "Source says 'charge for ten minutes, run for ten hours' — the literal phrase tests better in MX than the generic marketing term. Went with the specific.",
        meta: "Decision logged",
      },
      {
        id: "m6", when: "2h ago", kind: "completed",
        project: "Meridian", document: "meridian-q1-update.docx", pair: "EN → ES",
        title: "Exported meridian-q1-update.docx — EN→ES",
        body: "2,140 words cleared. Your glossary caught 3 terms I wouldn't have. Nice.",
        meta: "DOCX · exported",
      },
    ],
    // Live queue — what's processing right now
    queue: [
      {
        id: 3001, file: "onboarding-strings.docx", project: "Harbor App",
        pair: "EN → ES", progress: 72, eta: "90s",
        stage: "insight_check", // analyze | translate | insight_check | finalize
        blocks_done: 43, blocks_total: 60, confidence: 0.94,
      },
      {
        id: 3002, file: "onboarding-strings.docx", project: "Harbor App",
        pair: "EN → MX", progress: 68, eta: "2m",
        stage: "translate",
        blocks_done: 41, blocks_total: 60, confidence: 0.92,
      },
      {
        id: 1003, file: "nova-hero-copy.docx", project: "Nova Launch",
        pair: "EN → FR", progress: 64, eta: "2m",
        stage: "translate",
        blocks_done: 18, blocks_total: 28, confidence: 0.89,
      },
      {
        id: 2004, file: "atlas-footer-copy.txt", project: "Atlas Newsletter",
        pair: "EN → DE", progress: 42, eta: "3m",
        stage: "translate",
        blocks_done: 29, blocks_total: 68, confidence: 0.91,
      },
      {
        id: 1006, file: "nova-press-release.rtf", project: "Nova Launch",
        pair: "EN → FR", progress: 28, eta: "5m",
        stage: "analyze",
        blocks_done: 12, blocks_total: 42, confidence: 0.88,
      },
      {
        id: 3003, file: "onboarding-strings.docx", project: "Harbor App",
        pair: "EN → FR", progress: 54, eta: "3m",
        stage: "translate",
        blocks_done: 32, blocks_total: 60, confidence: 0.90,
      },
    ],
    // Decisions log — past ~24h
    decisions_log: [
      { id: "d1", when: "3m ago", type: "question",   text: "Flagged 2 ambiguities in nova-press-release.rtf · ES" },
      { id: "d2", when: "8m ago", type: "completed",  text: "nova-email-announce.txt · ES — shipped clean" },
      { id: "d3", when: "22m",    type: "glossary",   text: "Applied 'lanzamiento' in 14 places (Atlas)" },
      { id: "d4", when: "35m",    type: "memory",     text: "12 memory matches ≥92% applied (Nova hero)" },
      { id: "d5", when: "41m",    type: "question",   text: "Flagged 'partner' ambiguity (Atlas · DE)" },
      { id: "d6", when: "1h",     type: "edit",       text: "Replaced 'carga rápida' → 'carga en diez minutos' (Nova MX)" },
      { id: "d7", when: "2h",     type: "completed",  text: "meridian-q1-update.docx · ES — exported" },
      { id: "d8", when: "3h",     type: "glossary",   text: "Added 'Nova' to do-not-translate (from your earlier edit)" },
    ],
  };

  // Rich review data for the "Open full review" destination.
  // Keyed by jobId — blocks with aligned source/target segments, insights attached.
  const reviewData = {
    1004: {
      jobId: 1004,
      document: "nova-press-release.rtf",
      project: "Nova Launch — Spring Campaign",
      projectId: 1,
      source: "en", target: "es-ES",
      stats: { blocks: 8, approved: 3, pending: 3, insights: 22, ambiguities: 2 },
      agent_summary: "I translated 8 blocks. 3 are solid memory matches I've already approved. 3 are pending your read. 2 are genuinely ambiguous — I've lined up options for each.",
      blocks: [
        {
          id: "B01",
          source: "Today we're unveiling Nova, a wireless headphone built around the simple idea that great sound should disappear into the moment.",
          target: "Hoy presentamos Nova, unos auriculares inalámbricos diseñados en torno a una idea simple: que el gran sonido debería desaparecer en el momento.",
          status: "approved",
          insights: [
            { kind: "glossary", term: "Nova", note: "Product name — do not translate", confidence: 1.0 },
            { kind: "memory", note: "Strong match from Autumn Nova campaign", confidence: 0.92 },
          ],
          alignment: [
            { s: "Today", t: "Hoy" },
            { s: "we're unveiling Nova", t: "presentamos Nova" },
            { s: "a wireless headphone", t: "unos auriculares inalámbricos" },
            { s: "great sound", t: "el gran sonido", glossary: true },
            { s: "disappear into the moment", t: "desaparecer en el momento" },
          ],
        },
        {
          id: "B02",
          source: "Built for creators who move between studio and street, Nova pairs studio-grade drivers with adaptive noise cancellation that learns your environment.",
          target: "Creados para quienes se mueven entre el estudio y la calle, Nova combina controladores de calidad profesional con cancelación de ruido adaptativa que aprende de tu entorno.",
          status: "approved",
          insights: [
            { kind: "memory", note: "92% match — Autumn campaign, reused phrasing", confidence: 0.92 },
            { kind: "glossary", term: "adaptive noise cancellation", note: "Use 'cancelación de ruido adaptativa'", confidence: 1.0 },
          ],
        },
        {
          id: "B03",
          source: "Charge for ten minutes, run for ten hours.",
          target: "Cárgalos diez minutos, úsalos diez horas.",
          status: "ambiguity",
          insights: [
            { kind: "ambiguity", note: "Tagline structure — parallelism can read imperative (source-faithful) or editorial. I picked imperative." },
            { kind: "memory", note: "No direct memory match — first time this tagline appears", confidence: 0.0 },
          ],
          alternatives: [
            { text: "Cárgalos diez minutos, úsalos diez horas.", tone: "Imperative — source-faithful", recommended: true },
            { text: "Diez minutos de carga, diez horas de uso.", tone: "Editorial — brand-forward" },
            { text: "Diez minutos cargando, diez horas escuchando.", tone: "Active — punchy, rhythmic" },
          ],
          agent_reasoning: "I'd keep the imperative — it matches how Nova speaks in your memory of past campaigns. But the editorial option fits better if the press release is more formal than the landing page.",
        },
        {
          id: "B04",
          source: "Nova ships in three finishes — Ink, Sand, and Moss — each cut from recycled aluminum.",
          target: "Nova llega en tres acabados —Tinta, Arena y Musgo—, fabricados con aluminio reciclado.",
          status: "ambiguity",
          insights: [
            { kind: "glossary", term: "Ink / Sand / Moss", note: "Color names — approved Spanish set: Tinta / Arena / Musgo", confidence: 1.0 },
            { kind: "ambiguity", note: "\"Ships in\" is colloquial; I picked 'llega en' over literal 'se envía en'." },
          ],
          alternatives: [
            { text: "Nova llega en tres acabados —Tinta, Arena y Musgo—, fabricados con aluminio reciclado.", tone: "Natural — preferred", recommended: true },
            { text: "Nova se ofrece en tres acabados —Tinta, Arena y Musgo—, cortados en aluminio reciclado.", tone: "Literal — source-faithful" },
          ],
          agent_reasoning: "'Se envía' reads like shipping & handling. 'Llega' reads like a launch announcement, which is the register of the surrounding copy.",
        },
        {
          id: "B05",
          source: "Pre-orders open today at helvara.example.com/nova.",
          target: "Las reservas abren hoy en helvara.example.com/nova.",
          status: "pending",
          insights: [],
        },
        {
          id: "B06",
          source: "Price starts at $299 USD, with regional pricing in local currencies at checkout.",
          target: "El precio inicia en 299 USD, con precios regionales en monedas locales al pagar.",
          status: "pending",
          insights: [{ kind: "glossary", term: "USD", note: "Keep currency codes as-is" }],
        },
        {
          id: "B07",
          source: "Nova will be available wherever Helvara ships — North America, the UK, EU, and Mexico at launch.",
          target: "Nova estará disponible dondequiera que Helvara opere —América del Norte, Reino Unido, UE y México en el lanzamiento—.",
          status: "pending",
          insights: [
            { kind: "glossary", term: "EU", note: "Abbreviate as 'UE' in Spanish", confidence: 1.0 },
            { kind: "memory", note: "Similar phrasing used in 2025 launch: 'dondequiera que Helvara opere'", confidence: 0.88 },
          ],
        },
        {
          id: "B08",
          source: "We can't wait for you to hear it.",
          target: "Estamos deseando que lo escuches.",
          status: "pending",
          insights: [{ kind: "memory", note: "Consistent with past brand voice closing lines", confidence: 0.85 }],
        },
      ],
    },
  };


  const insightsSummary = {
    glossary_terms: 184,
    new_this_week: 6,
    conflicts: 2,
    memory_matches_week: 312,
    ambiguity_rate: 4.2, // percent of blocks flagged
  };

  // Rich block-level data for one job — review peek drill-in
  const reviewBlocks = {
    1004: [
      {
        id: "b1",
        source: "Today we're unveiling Nova, a wireless headphone built around the simple idea that great sound should disappear into the moment.",
        target: "Hoy presentamos Nova, unos auriculares inalámbricos creados en torno a la idea de que un gran sonido debería disiparse en el momento.",
        status: "approved",
        insights: [{ kind: "glossary", term: "Nova", note: "Product name — do not translate" }],
      },
      {
        id: "b2",
        source: "Built for creators who move between studio and street, Nova pairs studio-grade drivers with adaptive noise cancellation that learns your environment.",
        target: "Diseñados para creadores que se mueven entre el estudio y la calle, Nova combina controladores de calidad profesional con cancelación de ruido adaptativa que aprende de tu entorno.",
        status: "approved",
        insights: [{ kind: "memory", note: "92% match — Autumn campaign" }],
      },
      {
        id: "b3",
        source: "Charge for ten minutes, run for ten hours.",
        target: "Cárgalos diez minutos, úsalos diez horas.",
        status: "ambiguity",
        alternatives: [
          "Cárgalos diez minutos, úsalos diez horas.",
          "Diez minutos de carga, diez horas de uso.",
          "Diez minutos cargando, diez horas escuchando.",
        ],
        ambiguityReason: "Tagline structure — parallelism can be preserved with different verb forms. Option 2 reads more editorial; Option 1 preserves the imperative voice of the source.",
        insights: [{ kind: "ambiguity", note: "Marketing tagline — brand voice" }],
      },
      {
        id: "b4",
        source: "Nova ships in three finishes — Ink, Sand, and Moss — each cut from recycled aluminum.",
        target: "Nova se ofrece en tres acabados —Tinta, Arena y Musgo— cortados en aluminio reciclado.",
        status: "ambiguity",
        alternatives: [
          "Nova se ofrece en tres acabados —Tinta, Arena y Musgo— cortados en aluminio reciclado.",
          "Nova llega en tres acabados —Tinta, Arena y Musgo—, fabricados con aluminio reciclado.",
        ],
        ambiguityReason: "\u201CShips in\u201D is colloquial \u2014 literal (\u201Cse env\u00EDa\u201D) reads stiff. Both options adapt naturally; Option 2 is slightly more modern.",
        insights: [{ kind: "glossary", term: "Ink / Sand / Moss", note: "Color names — approved Spanish set" }],
      },
      {
        id: "b5", source: "Pre-orders open today at helvara.example.com/nova.",
        target: "Las reservas abren hoy en helvara.example.com/nova.",
        status: "pending", insights: [],
      },
      {
        id: "b6", source: "We can't wait for you to hear it.",
        target: "Estamos deseando que lo escuches.",
        status: "pending", insights: [{ kind: "memory", note: "Consistent with past brand voice" }],
      },
    ],
  };

  return { projects, reviewBlocks, attention, activity, autopilotRunning, insightsSummary, autopilot, reviewData };
})();
