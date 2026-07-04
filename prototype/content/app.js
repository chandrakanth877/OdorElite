/* OdorElite content pages: guides & policies (spec section 8.5).
   A static registry keyed by ?page= renders policies and guides;
   no param (or an unknown one) renders the index. */
(function () {
  "use strict";

  var root = el("content-root");
  var crumbs = el("crumbs");
  if (!root || !crumbs) return;

  /* ================= product picks (deterministic, from listing corpus) ================= */

  var PRODUCTS = (window.ODORELITE_LISTING && window.ODORELITE_LISTING.products) || [];

  function pickBest(filter, used) {
    var best = null;
    for (var i = 0; i < PRODUCTS.length; i++) {
      var p = PRODUCTS[i];
      if (!p.avail || used[p.id] || !filter(p)) continue;
      if (!best || p.discount > best.discount || (p.discount === best.discount && p.id < best.id)) best = p;
    }
    if (best) used[best.id] = true;
    return best;
  }

  // One in-stock product per guide, never shared between guides:
  // signature scent gets the deepest niche markdown, EDT vs EDP gets the
  // deepest EDP markdown, layering gets the deepest amber-family markdown.
  var PICKS = (function () {
    var used = {};
    return {
      "guide-signature-scent": pickBest(function (p) { return p.niche === 1; }, used),
      "guide-edt-vs-edp": pickBest(function (p) { return p.conc === "EDP" && p.compareAt > p.price; }, used),
      "guide-layering": pickBest(function (p) { return p.fam === "Amber & Oriental"; }, used)
    };
  })();

  /* ================= policy registry ================= */

  var POLICIES = {

    shipping: {
      title: "Shipping & delivery",
      blurb: "Rates, speeds, processing times, and what to do when a package runs late.",
      toc: false,
      sections: [
        {
          id: "rates",
          h: "Rates and delivery speeds",
          body: [
            "Standard shipping is free on every order over $50, no code needed. The threshold is based on your merchandise subtotal after any discounts, before tax.",
            "<div class='table-scroll'><table class='rate-table'><thead><tr><th scope='col'>Method</th><th scope='col'>Delivery estimate</th><th scope='col'>Cost</th></tr></thead><tbody>" +
              "<tr><td>Standard</td><td>3 to 5 business days</td><td>$6.95 (free over $50)</td></tr>" +
              "<tr><td>Express</td><td>2 business days</td><td>$14.95</td></tr>" +
              "<tr><td>Overnight</td><td>Next business day</td><td>$24.95</td></tr>" +
            "</tbody></table></div>",
            "Delivery estimates count business days from the day your order ships, not the day you place it. Express and overnight orders placed after the daily cutoff ship the next business day."
          ]
        },
        {
          id: "processing",
          h: "Order processing",
          body: [
            "Orders placed before 2:00 PM Eastern, Monday through Friday, leave our warehouse the same business day. Orders placed after the cutoff, on weekends, or on US holidays ship the next business day.",
            "You will receive two emails from us: one confirming your order the moment it is placed, and one with tracking the moment it ships. During launch weeks and holiday peaks, processing can take one extra business day; if that happens we say so on the cart page before you check out."
          ]
        },
        {
          id: "tracking",
          h: "Tracking your order",
          body: [
            "Your shipping confirmation email includes a tracking number and a direct carrier link. You can also check status any time on our <a href='../track/'>Track your order</a> page using your order number and email.",
            "Please allow up to 24 hours after the shipping email for the carrier to post the first scan. A label that shows no movement for a day usually means the package is between scan points, not lost."
          ]
        },
        {
          id: "where",
          h: "Where we ship",
          body: [
            "We currently ship to all 50 US states and the District of Columbia. PO boxes and APO/FPO/DPO addresses are served by standard shipping only, since express carriers cannot deliver to them.",
            "We do not ship internationally at this time. Fragrance is regulated as a dangerous good in air freight, and cross-border compliance is a project we want to get right before we open it up."
          ]
        },
        {
          id: "packaging",
          h: "How fragrance ships",
          body: [
            "Perfume contains alcohol, so carriers classify it as a limited-quantity shipment. Every bottle leaves our warehouse in its sealed retail box, wrapped in padding, and packed so it cannot shift in transit.",
            "A few oversized bottles are restricted to ground transport by carrier rules, which means express or overnight may be unavailable for them at checkout. Orders over $300 require a signature at delivery."
          ]
        },
        {
          id: "delays",
          h: "Late, lost, or damaged in transit",
          body: [
            "If tracking has not moved for 5 business days, contact us at <a href='mailto:demo@odorelite.example'>demo@odorelite.example</a> with your order number and we will open a trace with the carrier and make it right, by replacement or refund.",
            "If a package arrives damaged, photograph the outer box and the contents before discarding anything and send the photos within 7 days of delivery. See our <a href='./?page=returns'>returns policy</a> for how replacements and refunds work."
          ]
        }
      ]
    },

    returns: {
      title: "Returns & refunds",
      blurb: "30 days for unopened bottles, how refunds work, and our authenticity guarantee.",
      toc: false,
      sections: [
        {
          id: "window",
          h: "The 30-day window",
          body: [
            "You can return any unopened, unused fragrance within 30 days of delivery for a full merchandise refund. The window starts on the delivery date shown by the carrier, not the order date.",
            "Unopened means the retail box is intact and any cellophane wrap or brand seal is unbroken. This is not us being fussy: it is what lets us stand behind every bottle we sell as new and authentic."
          ]
        },
        {
          id: "eligibility",
          h: "What qualifies",
          body: [
            "<ul><li>Unopened bottles in their original sealed packaging: eligible.</li><li>Opened, sprayed, or tested bottles: not eligible, for hygiene and authenticity reasons.</li><li>Gift sets: eligible only when complete and sealed.</li><li>Items marked final sale on the product page: not eligible.</li></ul>",
            "If a bottle arrived damaged or we shipped the wrong item, none of the above applies; see the damaged and wrong items section below and we will fix it at no cost to you."
          ]
        },
        {
          id: "start",
          h: "How to start a return",
          body: [
            "Email <a href='mailto:demo@odorelite.example'>demo@odorelite.example</a> with your order number and the item you want to return. We reply within one business day with a prepaid return label.",
            "Pack the item in a shipping box (the retail box alone is not enough protection), attach the label, and drop it off within 14 days of receiving the label. Keep your drop-off receipt until the refund lands."
          ]
        },
        {
          id: "refunds",
          h: "Refunds",
          body: [
            "Once your return arrives and passes inspection, we issue the refund to your original payment method within 5 to 10 business days. Your bank may take a few additional days to post it.",
            "Original shipping charges are not refundable unless the return is due to our error. For change-of-mind returns, the cost of the prepaid label ($6.95) is deducted from the refund; for our errors, we cover everything."
          ]
        },
        {
          id: "damaged",
          h: "Damaged, wrong, or missing items",
          body: [
            "If anything arrives broken, leaking, incorrect, or missing, contact us within 7 days of delivery with your order number and photos of the box and contents. You do not need to return a damaged bottle unless we ask.",
            "We will send a replacement at no charge or refund the item in full, including shipping, whichever you prefer."
          ]
        },
        {
          id: "authenticity",
          h: "Our authenticity guarantee",
          body: [
            "Every fragrance we sell is 100% authentic, sourced from authorized distributors and verified at intake. We never sell testers as retail stock, refills, or gray-market rebottles.",
            "If you ever doubt the authenticity of a bottle you bought from us, contact us. We will investigate with our supplier and, if we cannot resolve your doubt, refund you in full regardless of the return window."
          ]
        }
      ]
    },

    privacy: {
      title: "Privacy policy",
      blurb: "What we collect, how cookies and local storage are used, and the choices you have.",
      toc: true,
      sections: [
        {
          id: "collect",
          h: "Information we collect",
          body: [
            "When you shop with us we collect the information you give us directly: your name, email address, shipping and billing addresses, phone number, and the items you order. If you create an account, we also store your saved addresses, saved payment references, and wishlist.",
            "We collect a small amount of information automatically: the pages you visit on our site, the searches you run, and basic device information such as browser type. We use this to keep the site working and to understand which products people are looking for."
          ]
        },
        {
          id: "use",
          h: "How we use your information",
          body: [
            "We use your information to fulfill orders, deliver packages, answer support requests, and prevent fraud. If you opt in to our newsletter, we use your email to send it; we never sign you up by default.",
            "We also use aggregate, de-identified browsing data to decide which brands to stock and which pages to improve. That analysis never identifies you personally."
          ]
        },
        {
          id: "cookies",
          h: "Cookies and local storage",
          body: [
            "We use cookies and browser local storage to remember your cart, wishlist, sign-in state, and preferences between visits. Without them, your cart would empty every time you closed the tab.",
            "Because this site is a prototype, there is something unusual to disclose: everything you enter here (cart, wishlist, demo orders, demo addresses) is stored only in your own browser's local storage. Nothing is transmitted to or kept on a server. Clearing your browser data resets the store completely."
          ]
        },
        {
          id: "sharing",
          h: "When we share information",
          body: [
            "We share information only with the service providers who make the store run: shipping carriers receive your delivery address, payment processors handle your card (we never see or store full card numbers), and our email provider sends order confirmations.",
            "We do not sell your personal information, and we do not share it with advertisers. If a law enforcement request legally compels disclosure, we will disclose the minimum required and, where allowed, tell you."
          ]
        },
        {
          id: "choices",
          h: "Your choices and rights",
          body: [
            "You can unsubscribe from marketing email with one click at the bottom of any message; transactional emails such as order confirmations still arrive because they are part of the service.",
            "You can view and edit your account information any time from your account page, and you can ask us to delete your account and its data by emailing <a href='mailto:demo@odorelite.example'>demo@odorelite.example</a>. Depending on your state of residence, you may have additional rights to access, correct, or delete personal information, and we honor those requests regardless of state."
          ]
        },
        {
          id: "security",
          h: "Data retention and security",
          body: [
            "We keep order records for as long as tax and consumer-protection rules require, and account data for as long as your account is active. When you delete your account, we remove personal data that we are not legally required to retain.",
            "All traffic to the site is encrypted in transit. Payment card numbers are handled by our payment processor and never touch our systems; we store only the card network and last four digits so you can recognize your saved cards."
          ]
        },
        {
          id: "children",
          h: "Children's privacy",
          body: [
            "Our store is intended for adults and is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us information, contact us and we will delete it."
          ]
        },
        {
          id: "contact",
          h: "Contact us",
          body: [
            "Questions about this policy or about your data can go to <a href='mailto:demo@odorelite.example'>demo@odorelite.example</a>. We answer privacy requests within 30 days, usually much faster."
          ]
        }
      ]
    },

    terms: {
      title: "Terms of service",
      blurb: "The rules of using the store: accounts, pricing, orders, and liability.",
      toc: true,
      sections: [
        {
          id: "agreement",
          h: "Agreement to these terms",
          body: [
            "By browsing this site or placing an order, you agree to these terms of service and to our <a href='./?page=privacy'>privacy policy</a>. If you do not agree, please do not use the site.",
            "These terms apply to every visitor, whether or not you create an account. Where a specific policy (shipping, returns) covers a topic in more detail, that policy controls for that topic."
          ]
        },
        {
          id: "account",
          h: "Your account",
          body: [
            "You are responsible for the accuracy of the information on your account and for keeping your password confidential. Anything done through your account is treated as done by you, so tell us immediately if you suspect unauthorized access.",
            "You must be at least 18 years old, or the age of majority where you live, to place an order. We may suspend or close accounts used for fraud, abuse, or resale misrepresentation."
          ]
        },
        {
          id: "pricing",
          h: "Products, pricing, and errors",
          body: [
            "All prices are in US dollars. Where we show a comparison price, it reflects the brand's suggested retail price for the same item and size; our selling price is what you pay.",
            "Despite our best efforts, a product may occasionally be mispriced or listed with incorrect information. If an item's correct price is higher than the price displayed when you ordered, we will cancel the affected order and refund you in full, and we will notify you before doing so where practical. Product availability is not guaranteed until your order ships."
          ]
        },
        {
          id: "orders",
          h: "Orders and payment",
          body: [
            "Placing an order is an offer to purchase. We accept the offer when we ship, and we may decline or limit orders at our discretion, for example when a payment cannot be verified or quantities exceed household limits.",
            "Your payment method is authorized at checkout and charged when your order is placed. If we cancel any part of an order, the corresponding charge is refunded to the original payment method."
          ]
        },
        {
          id: "shipping-returns",
          h: "Shipping, returns, and risk of loss",
          body: [
            "Shipping timelines, costs, and delivery terms are described in our <a href='./?page=shipping'>shipping policy</a>; return eligibility and refunds are described in our <a href='./?page=returns'>returns policy</a>. Both are part of these terms.",
            "Risk of loss passes to you when the carrier confirms delivery to your address. Lost-in-transit packages are our responsibility to trace and resolve, as described in the shipping policy."
          ]
        },
        {
          id: "conduct",
          h: "Acceptable use and intellectual property",
          body: [
            "You agree not to scrape the site at scale, probe or disrupt its infrastructure, use bots to purchase inventory, or misrepresent yourself in reviews or support requests.",
            "The site's content (text, photography, design, and the OdorElite name and mark) belongs to us or our licensors. Brand names of the fragrances we sell belong to their respective owners, who do not sponsor or endorse this store."
          ]
        },
        {
          id: "liability",
          h: "Disclaimers and limitation of liability",
          body: [
            "The site is provided as is and as available. To the fullest extent permitted by law, we disclaim warranties not expressly stated here, and our total liability for any claim arising from a purchase is limited to the amount you paid for the products in that order.",
            "Nothing in these terms limits liability that cannot be limited under applicable law, including liability for products that cause personal injury where the law provides that protection."
          ]
        },
        {
          id: "law",
          h: "Governing law and changes",
          body: [
            "A production version of this page would name a governing state and venue here. This prototype leaves the governing-law clause as a placeholder on purpose, since the demo store has no legal domicile.",
            "We may update these terms from time to time. The date at the top reflects the latest revision, and material changes will be announced on the site before they take effect. Continued use after a change means you accept the revised terms."
          ]
        }
      ]
    }
  };

  /* ================= guide registry ================= */

  var GUIDES = {

    "guide-signature-scent": {
      title: "How to choose your signature scent",
      tag: "Fragrance basics",
      blurb: "A working method for finding the one: families, the note pyramid, and testing like a professional.",
      pickAfter: 2,
      pickLabel: "One to try",
      pickNote: "Chosen automatically: the deepest in-stock niche markdown in the catalog right now.",
      sections: [
        {
          h: "Start with a family, not a bottle",
          body: [
            "Four thousand bottles all shout at once, so narrow the field before you smell a single one. Perfumers group scents into families, and four of them cover most of what exists: fresh (citrus, aquatics, cut-grass greens), floral (rose, jasmine, tuberose, soft powdery bouquets), amber (vanilla, resins, warm spice, the family older books call oriental), and woody (sandalwood, cedar, vetiver, oud).",
            "You already have data about which family is yours. Look at what you reach for without thinking: the candle you rebuy, the soap you like, the tea you brew, even the shampoo you kept for the smell. If your bathroom leans citrus and mint, start in fresh. If your shelf is amber candles and chai, start in amber. Picking a family first turns an overwhelming wall into a shortlist of a dozen candidates, and it means every test you do afterward teaches you something about your own taste rather than about random bottles."
          ]
        },
        {
          h: "Learn the note pyramid",
          body: [
            "A fragrance is built in three layers that reveal themselves over time. Top notes are what you smell in the first 15 to 30 minutes: citrus, herbs, light fruits, the sparkling aldehydes. They are the most volatile molecules, which is why they arrive first and vanish first. Heart notes carry the next two to four hours: most florals, spices, and fruit live here, and they define the fragrance's character. Base notes are the heavy, slow molecules (musks, woods, amber, vanilla, resins) that anchor everything and can linger into the next morning.",
            "The practical lesson: never judge a fragrance by its opening. The top notes are the salesperson; the drydown is the roommate. A scent that dazzles on the first spray can turn soapy or sour by hour three, and a shy opening can settle into something you cannot stop smelling. Give every candidate at least two hours on skin before you form an opinion, and make the drydown, not the opening, the thing you fall in love with."
          ]
        },
        {
          h: "Test like a professional",
          body: [
            "Blotter strips are for screening, skin is for deciding. Paper shows you the perfume as the perfumer composed it; your skin shows you the version you will actually wear, warped by your own chemistry, and the two can differ a lot. Use strips to eliminate obvious mismatches, then commit your forearms to the two or three survivors.",
            "Limit yourself to three or four fragrances per session. Your nose fatigues quickly, and by the sixth spray everything smells like the fifth. Between scents, breathe against your own sleeve or step outside for fresh air; it resets your nose better than any jar of coffee beans. Then run the real test: wear one candidate, alone, for a full day. Notice it at your desk, after a walk, at hour six. Ask someone whose taste you trust what they think, but weight your own reaction more heavily. You are the one who has to live inside it."
          ]
        },
        {
          h: "Fit the scent to your life",
          body: [
            "A signature scent has to survive your actual week, not an imaginary one. If you work in a shared office, an enormous amber cloud will make enemies by Wednesday; look at clean musks, soft woods, light florals, and citrus that stays close to the skin. If your evenings out matter more, richer ambers, oud blends, and intense concentrations earn their keep after dark. A quick self-check before you commit: spray your candidate at 8 AM and ask whether you would still be comfortable sitting next to yourself in a 2 PM meeting.",
            "Climate is the other honest constraint. Heat amplifies everything: a sweet vanilla that behaves in January can become syrup in July, while fresh citrus that sings in summer disappears in a cold wind. This is why many people end up with a small wardrobe instead of a single bottle: one daytime workhorse, one evening scent, one warm-weather alternate. That is still a signature; it is a signature with seasons. Choose the daytime bottle first, since it will log the most wears."
          ]
        },
        {
          h: "Commit slowly, then buy big",
          body: [
            "The signature-scent mistake everyone makes once: buying a full bottle on the strength of one great blotter sniff. Work in stages instead. Start with a sample or travel spray, and only consider the big bottle after eight to ten real wears through different weather and moods. If you still reach for it eagerly on wear ten, that is the signal.",
            "Then, and only then, size up. Larger bottles almost always cost less per ounce, and a scent you wear daily justifies the biggest format on the shelf. Discounted designer and niche bottles make this stage kinder to your budget than the department-store counter ever will. One caution: buy the size you will finish in two or three years. Perfume keeps well away from heat and light, but your taste evolves, and a signature is allowed to change with you. And if a scent you are still deciding on sells out, resist the panic buy; fragrance supply moves in waves, and restocks are far more common than the forums suggest."
          ]
        }
      ]
    },

    "guide-edt-vs-edp": {
      title: "EDT vs EDP: what concentration really means",
      tag: "Know your labels",
      blurb: "Toilette, parfum, extrait: what the letters change about strength, longevity, and price.",
      pickAfter: 2,
      pickLabel: "A deep EDP deal",
      pickNote: "Chosen automatically: the biggest in-stock EDP markdown in the catalog right now.",
      sections: [
        {
          h: "What the letters actually mean",
          body: [
            "Every fragrance is perfume oil dissolved in alcohol and a little water, and the label tells you roughly how much oil is in the mix. Eau de cologne (EDC) typically runs 2 to 4 percent oil. Eau de toilette (EDT) runs about 5 to 15 percent. Eau de parfum (EDP) sits around 15 to 20 percent. Parfum or extrait de parfum, the strongest common form, runs 20 to 40 percent. The rest of the bottle is the carrier: perfumer's alcohol plus a small amount of water, which is why a fresh spray smells sharpest in the seconds before the alcohol flashes off.",
            "Two caveats keep these numbers honest. First, there is no legal standard: one house's EDT can carry more oil than another's EDP, so the ranges are conventions, not guarantees. Second, more oil does not automatically mean better. Concentration is a design decision, like choosing between a sketch and an oil painting. Each format suits different moments, which is exactly why brands sell the same name in several strengths."
          ]
        },
        {
          h: "Concentration changes more than strength",
          body: [
            "Here is the part most shoppers miss: an EDP is usually not just a stronger pour of the EDT. When a house builds a second concentration, the perfumer often rebalances the formula itself. EDTs tend to push the bright top notes forward: more citrus, more fizz, a fresher and more transparent character built for daylight. EDPs typically deepen the base: more amber, more musk, more sweetness, a rounder and warmer profile.",
            "The result is that the EDT and EDP of the same fragrance can feel like siblings rather than twins, and plenty of wearers honestly prefer the lighter one. If you loved a scent in one concentration and buy the other blind, expect a cousin, not a clone. When both are available, test both: you are choosing between two interpretations, not between weak and strong versions of one thing. The price gap between them is usually modest compared with the difference in character, so let your nose make the call rather than the assumption that bigger numbers are better."
          ]
        },
        {
          h: "Longevity, honestly",
          body: [
            "Rough working averages on skin: an EDC gives two to three hours, an EDT four to six, an EDP six to eight, and a parfum or extrait eight to twelve or beyond. Projection follows a different curve: EDTs often open louder because their volatile top notes leap off the skin, while extraits can wear closer to the body even as they last far longer.",
            "Your results will vary, and the variables matter as much as the label. Dry skin releases scent faster than moisturized skin; heat and humidity amplify projection but burn through the top; fragrance sprayed on fabric lasts longer but develops less. Note profile can outweigh concentration entirely: a citrus-dominant parfum can fade before a dense woody EDT. Treat the label as a starting estimate and your own skin as the final measurement. If longevity is your priority, test a candidate on your inner elbow in the morning and check it again before dinner; that single data point beats any chart of averages, including this one."
          ]
        },
        {
          h: "Which one should you buy?",
          body: [
            "Match the concentration to the job. For offices, warm climates, and daytime errands, an EDT is usually the smarter buy: brighter, politer in shared air, and cheaper per bottle. For evenings, cold weather, and occasions where you want a scent that survives a long night, the EDP earns its premium. Extraits are for devotees: intimate, long-lasting, and priced accordingly.",
            "Run the price-per-wear math before assuming the EDT is the economy option. An EDP costs more per bottle but often needs two or three sprays where the EDT wants five, and it may spare you a midday reapplication. If you split the difference, a common collector's move is to own the EDT for summer and the EDP for winter of a scent you truly love. And whichever you choose, spray on moisturized skin: it is the cheapest longevity upgrade there is. Sample sizes make the whole experiment inexpensive, since a travel spray of each concentration costs less than a full-bottle mistake in either direction."
          ]
        },
        {
          h: "Read the shelf like a pro",
          body: [
            "Concentration is only one line of fine print worth reading. Flankers, the sequels of the perfume world, share a name plus a suffix (Intense, Elixir, Extreme, Sport) and are frequently different fragrances altogether, not just stronger ones. Check the concentration and the flanker name before assuming you know what is in the box.",
            "Watch the other formats too. Body mists are very low concentration and priced to match; perfume oils skip the alcohol and wear close and quiet. When comparing prices across stores, always compare the same concentration and the same size, then divide price by ounces; a bigger discount percentage on a smaller bottle can still be the worse deal. Ten seconds of label reading and one division is the whole skill, and it will save you from most bad purchases. Every product page on this store lists the concentration and size right under the name, so you can run the comparison before the bottle ever reaches your cart."
          ]
        }
      ]
    },

    "guide-layering": {
      title: "Layering 101: build a scent no one else wears",
      tag: "Advanced wear",
      blurb: "Combine two fragrances into one signature: the rules, the pairings, and the order of operations.",
      pickAfter: 2,
      pickLabel: "A layering base",
      pickNote: "Chosen automatically: the deepest in-stock markdown from the amber family, a natural base layer.",
      sections: [
        {
          h: "Why layering works",
          body: [
            "Every perfume you own is already a blend of dozens of materials, balanced by a perfumer into a fixed accord. Layering simply adds one more voice to that choir. Spray a warm vanilla under a spiced rose and the rose reads richer; put a bright citrus over a heavy amber and the amber suddenly has daylight in it. You are not breaking the fragrances, you are shifting their balance.",
            "There are two practical payoffs. The first is originality: a combination of two bottles, in your ratio, on your skin, is effectively a scent nobody else wears, which is the whole promise of a signature. The second is repair: layering fixes shortcomings you already live with. A fragrance you love that dies in three hours gains stamina from a base-heavy partner. One that feels too dense for daytime lightens under something fresh. Your existing shelf gets bigger without buying a single new bottle."
          ]
        },
        {
          h: "The ground rules",
          body: [
            "Rule one: start quiet. Two sprays of each, not five, because a bad combination at low volume is a lesson while the same mistake at high volume is a long day. Rule two: give the pair a hierarchy. Choose one fragrance to lead and one to support; two dominant personalities shout over each other, and the blend turns to mud.",
            "Rule three: find the bridge. Pairs work when the two formulas share a note that lets them hold hands: vanilla, musk, rose, citrus, and sandalwood are the friendliest bridges because they appear in thousands of compositions. Check the note pyramids on the product pages and look for the overlap. Rule four: know what not to mix. Two dense ambers smother each other, two loud ouds start a fight, and two aquatics just make a bigger aquatic. Contrast plus a bridge beats similarity. And run your first experiments on a weekend, never the morning of an interview."
          ]
        },
        {
          h: "Pairings that rarely miss",
          body: [
            "Some combinations succeed so reliably they are practically recipes. Keep these five in your back pocket:",
            "<ul><li><strong>Vanilla under tobacco or spice.</strong> Vanilla rounds sharp edges and adds sweetness the way sugar tames strong coffee.</li><li><strong>Rose plus oud.</strong> The classic pairing of Middle Eastern perfumery; the rose lifts, the oud grounds, and each hides the other's excess.</li><li><strong>Citrus over amber.</strong> A lemon or bergamot-forward scent gives a heavy amber a bright opening it never had.</li><li><strong>Clean musk under anything.</strong> A skin-scent musk is the little black dress of layering: it deepens whatever sits on top without changing its character.</li><li><strong>Fresh aromatic with dry woods.</strong> Lavender or herbal scents over cedar and vetiver read crisp, tailored, and office-safe.</li></ul>",
            "Notice the pattern: each pair contrasts texture (light against heavy, bright against dark) while sharing an obvious bridge. When you invent your own combinations, copy that structure and your hit rate will surprise you."
          ]
        },
        {
          h: "Order, placement, and skin prep",
          body: [
            "Sequence matters. Apply the heavier, base-driven fragrance first, closest to the skin, and let it settle for a minute or two; then apply the lighter partner over or beside it. Done in reverse, the heavyweight buries the lighter scent before it ever gets to speak.",
            "You have two placement strategies. Layering on the same spot produces a true blend, one new scent where the two meet. Splitting locations (the warm amber on your chest, the citrus on your neck and wrists) produces a gradient that shifts as you move and as hours pass, top layer fading first, base layer closing the night. Both are legitimate; try each with the same pair and notice how different they feel. Before any of it, moisturize with an unscented lotion: hydrated skin holds both layers dramatically longer. Spray from about six inches, and never rub your wrists together, which crushes the top notes. Finally, give the finished combination ten minutes to settle before judging it; the alcohol flash-off of the second layer briefly distorts both."
          ]
        },
        {
          h: "Build a signature, slowly",
          body: [
            "Treat layering like learning to cook: master one dish before opening a restaurant. Pick a single pairing and wear it for a week, adjusting one variable at a time. Two sprays to one instead of two and two. Base on the chest instead of the wrist. The same pair can produce five different effects depending on ratio and placement, and only repetition teaches you which version is yours.",
            "Keep notes, literally. A line per wear is enough: what you combined, the ratio, the weather, how it behaved at hour four, whether anyone commented. Within a month you will have your own private recipe book, and one entry will keep pulling you back. That combination, worn consistently enough that people begin to associate it with you, is the endgame: a signature scent that cannot be bought off a shelf, because you built it. Rotate it seasonally like any other signature, and keep experimenting on weekends."
          ]
        }
      ]
    }
  };

  var GUIDE_ORDER = ["guide-signature-scent", "guide-edt-vs-edp", "guide-layering"];
  var POLICY_ORDER = ["shipping", "returns", "privacy", "terms"];

  /* ================= render helpers ================= */

  function blocks(arr) {
    return arr.map(function (b) {
      return b.charAt(0) === "<" ? b : "<p>" + b + "</p>";
    }).join("");
  }

  function setCrumbs(currentTitle) {
    var html = '<a href="../home/">Home</a>' +
      '<span class="crumb-sep" aria-hidden="true">&#8250;</span>';
    if (currentTitle) {
      html += '<a href="./">Guides &amp; policies</a>' +
        '<span class="crumb-sep" aria-hidden="true">&#8250;</span>' +
        '<span class="crumb-current" aria-current="page">' + esc(currentTitle) + "</span>";
    } else {
      html += '<span class="crumb-current" aria-current="page">Guides &amp; policies</span>';
    }
    crumbs.innerHTML = html;
  }

  function guideCard(key) {
    var g = GUIDES[key];
    var pick = PICKS[key];
    return (
      '<a class="guide-card" href="./?page=' + key + '">' +
        '<div class="guide-media">' + (pick ? imgTag(pick.img, g.title) : "") + "</div>" +
        '<div class="guide-body">' +
          '<p class="guide-tag">' + esc(g.tag) + "</p>" +
          '<p class="guide-title">' + esc(g.title) + "</p>" +
          '<p class="guide-excerpt">' + esc(g.blurb) + "</p>" +
          '<span class="guide-cta">Read guide</span>' +
        "</div>" +
      "</a>"
    );
  }

  function readingMinutes(g) {
    var words = 0;
    g.sections.forEach(function (s) {
      s.body.forEach(function (b) {
        words += b.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
      });
    });
    return Math.max(1, Math.round(words / 200));
  }

  /* ================= views ================= */

  function renderIndex() {
    document.title = "Guides & policies | OdorElite";
    setCrumbs(null);
    root.innerHTML =
      '<header class="page-head">' +
        '<h1 class="page-title">Guides &amp; policies</h1>' +
        '<p class="page-sub">How to shop scent with confidence, and the fine print in plain English.</p>' +
      "</header>" +
      '<section class="content-section" aria-labelledby="guides-h">' +
        '<h2 class="content-h2" id="guides-h">Fragrance guides</h2>' +
        '<div class="guide-grid">' + GUIDE_ORDER.map(guideCard).join("") + "</div>" +
      "</section>" +
      '<section class="content-section" aria-labelledby="policies-h">' +
        '<h2 class="content-h2" id="policies-h">Store policies</h2>' +
        '<div class="policy-grid">' +
          POLICY_ORDER.map(function (k) {
            var pol = POLICIES[k];
            return (
              '<a class="policy-card" href="./?page=' + k + '">' +
                "<h3>" + esc(pol.title) + "</h3>" +
                "<p>" + esc(pol.blurb) + "</p>" +
                '<span class="policy-cta">Read policy</span>' +
              "</a>"
            );
          }).join("") +
        "</div>" +
      "</section>";
  }

  function renderPolicy(key) {
    var pol = POLICIES[key];
    document.title = pol.title + " | OdorElite";
    setCrumbs(pol.title);
    var sectionsHtml = pol.sections.map(function (s) {
      return (
        '<section class="article-section policy-section" id="' + s.id + '" aria-labelledby="h-' + s.id + '">' +
          '<h2 id="h-' + s.id + '">' + esc(s.h) + "</h2>" + blocks(s.body) +
        "</section>"
      );
    }).join("");
    var articleHtml =
      '<article class="article">' +
        '<header class="article-head">' +
          '<p class="article-tag">Store policy</p>' +
          '<h1 class="article-title">' + esc(pol.title) + "</h1>" +
          '<p class="article-meta">Last updated July 2026</p>' +
        "</header>" +
        sectionsHtml +
        '<p class="policy-demo-note">Demo content for the OdorElite prototype, not legal advice.</p>' +
      "</article>";
    if (pol.toc) {
      root.innerHTML =
        '<div class="policy-layout">' +
          '<aside class="toc" aria-label="On this page">' +
            '<h2 class="toc-title">On this page</h2>' +
            "<nav><ul>" +
              pol.sections.map(function (s) {
                return '<li><a href="#' + s.id + '">' + esc(s.h) + "</a></li>";
              }).join("") +
            "</ul></nav>" +
          "</aside>" +
          articleHtml +
        "</div>";
      initTocSpy();
    } else {
      root.innerHTML = articleHtml;
    }
  }

  function renderGuide(key) {
    var g = GUIDES[key];
    var pick = PICKS[key];
    document.title = g.title + " | OdorElite";
    setCrumbs(g.title);

    var pickHtml = pick
      ? '<aside class="article-pick" aria-label="Featured product">' +
          '<p class="pick-label">' + esc(g.pickLabel) + "</p>" +
          OEUI.productCard(pick) +
          '<p class="pick-note">' + esc(g.pickNote) + "</p>" +
        "</aside>"
      : "";

    var sectionsHtml = g.sections.map(function (s, i) {
      return (
        '<section class="article-section">' +
          "<h2>" + esc(s.h) + "</h2>" + blocks(s.body) +
        "</section>" +
        (i === g.pickAfter ? pickHtml : "")
      );
    }).join("");

    var others = GUIDE_ORDER.filter(function (k) { return k !== key; });

    root.innerHTML =
      '<article class="article">' +
        '<header class="article-head">' +
          '<p class="article-tag">' + esc(g.tag) + "</p>" +
          '<h1 class="article-title">' + esc(g.title) + "</h1>" +
          '<p class="article-meta">' + readingMinutes(g) + ' min read &middot; Updated July 2026</p>' +
        "</header>" +
        sectionsHtml +
      "</article>" +
      '<section class="more-guides" aria-labelledby="more-h">' +
        '<h2 class="content-h2" id="more-h">More guides</h2>' +
        '<div class="guide-grid">' + others.map(guideCard).join("") + "</div>" +
      "</section>";
  }

  /* TOC scroll-spy: highlight the section currently in view (desktop only). */
  function initTocSpy() {
    if (!("IntersectionObserver" in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
    if (!links.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        links.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + id);
        });
      });
    }, { rootMargin: "-120px 0px -65% 0px", threshold: 0 });
    document.querySelectorAll(".policy-section").forEach(function (s) { observer.observe(s); });
  }

  /* ================= route ================= */

  var page = new URLSearchParams(window.location.search).get("page");

  if (!page) {
    renderIndex();
  } else if (POLICIES.hasOwnProperty(page)) {
    renderPolicy(page);
  } else if (GUIDES.hasOwnProperty(page)) {
    renderGuide(page);
  } else {
    renderIndex();
    toast("That page does not exist");
  }
})();
