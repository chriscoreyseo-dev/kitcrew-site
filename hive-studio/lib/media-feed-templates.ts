/** Image drafts for the common publishing jobs on MarketHive. */
export const TEMPLATE_MODEL = "z-image-turbo"

export const MEDIA_FEED_TEMPLATES = [
  {
    slug: "capture-page-hero",
    title: "Capture page hero",
    aspectRatio: "16:9",
    prompt:
      "Create a wide hero image for a signup page about [topic]. Place the main subject on the right and leave the left half quiet for a headline and signup button. Use natural light and leave out lettering.",
  },
  {
    slug: "product-shot",
    title: "Product shot",
    aspectRatio: "1:1",
    prompt:
      "Photograph [product] against a simple studio backdrop. Show the whole product, keep its details sharp, and use a soft side light with a subtle shadow.",
  },
  {
    slug: "meeting-flyer",
    title: "Meeting flyer",
    aspectRatio: "3:4",
    prompt:
      "Design a portrait flyer for [meeting name]. Set the title above an illustration of [topic]. Include [date and time] and [location] in a clear, readable block beneath it.",
  },
  {
    slug: "blog-header",
    title: "Blog header",
    aspectRatio: "16:9",
    prompt:
      "Create a wide editorial photograph to introduce a blog post about [topic]. Use [subject] as the focal point, keep it visible in a shallow crop, and leave out text.",
  },
  {
    slug: "group-splash",
    title: "Group splash",
    aspectRatio: "16:9",
    prompt:
      "Create a welcoming banner for [group name]. Show people taking part in [shared activity]. Keep faces near the center so they survive a narrower crop, and leave room for the group name.",
  },
] as const
