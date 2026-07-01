import fs from "fs/promises";

const OUTPUT_FILE = "data.json";

const EBAY_SELLER = "thecardsociety";
const EBAY_MARKETPLACE = "EBAY_GB";

const WHATNOT_SHOWS_URL = "https://www.whatnot.com/en-GB/user/thecardsocietybreaks/shows";
const WHATNOT_REVIEWS_URL = "https://www.whatnot.com/en-GB/user/thecardsocietybreaks/reviews";

async function getEbayAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET. Skipping eBay update.");
    return null;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay token error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchEbayItems() {
  const token = await getEbayAccessToken();

  if (!token) {
    return [];
  }

  const params = new URLSearchParams({
    limit: "12",
    filter: `sellers:{${EBAY_SELLER}}`
  });

  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay listing error: ${response.status} ${text}`);
  }

  const data = await response.json();

  return (data.itemSummaries || []).map(item => ({
    title: item.title || "eBay single",
    price: item.price
      ? `${item.price.currency} ${item.price.value}`
      : "View price on eBay",
    image: item.image?.imageUrl || "",
    link: item.itemWebUrl || "https://www.ebay.co.uk/usr/thecardsociety"
  }));
}

async function fetchInstagramPosts() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    console.log("Missing INSTAGRAM_ACCESS_TOKEN. Skipping Instagram update.");
    return [];
  }

  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: "10",
    access_token: token
  });

  const response = await fetch(`https://graph.instagram.com/me/media?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instagram error: ${response.status} ${text}`);
  }

  const data = await response.json();

  return (data.data || []).map(post => ({
    id: post.id,
    caption: post.caption || "",
    mediaType: post.media_type,
    image: post.thumbnail_url || post.media_url || "",
    link: post.permalink
  }));
}

function getFallbackReviews() {
  return [
    {
      rating: 5,
      text: "Great break, great energy and cards packed safely. Proper community feel.",
      name: "WhatNot buyer review"
    },
    {
      rating: 5,
      text: "Fast shipping, clear stream and a really fun seller to buy from.",
      name: "WhatNot buyer review"
    },
    {
      rating: 5,
      text: "Top quality breaks and a brilliant experience from start to finish.",
      name: "WhatNot buyer review"
    }
  ];
}

async function main() {
  console.log("Updating The Card Society Breaks data...");

  const ebayItems = await fetchEbayItems().catch(error => {
    console.error(error);
    return [];
  });

  const instagramPosts = await fetchInstagramPosts().catch(error => {
    console.error(error);
    return [];
  });

  const output = {
    updatedAt: new Date().toISOString(),
    ebayItems,
    instagramPosts,
    whatnot: {
      showsUrl: WHATNOT_SHOWS_URL,
      reviewsUrl: WHATNOT_REVIEWS_URL,
      reviews: getFallbackReviews()
    }
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(`Updated ${OUTPUT_FILE}`);
  console.log(`eBay items: ${ebayItems.length}`);
  console.log(`Instagram posts: ${instagramPosts.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
