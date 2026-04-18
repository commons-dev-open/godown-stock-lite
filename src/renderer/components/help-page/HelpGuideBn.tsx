import type { ReactNode } from "react";
import type { i18n as I18n } from "i18next";
import type { HelpTabId } from "./types";
import { HelpBulletList, HelpStepList, HelpSubSection } from "./HelpPrimitives";
import { getHelpGuideTerms } from "./getHelpGuideTerms";

/** Bengali help bodies; screen names come from live locale strings via `getHelpGuideTerms`. */
export function buildBengaliHelpBodies(i18n: I18n): Record<HelpTabId, ReactNode> {
  const terms = getHelpGuideTerms(i18n);

  return {
    overview: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {terms.appName}{" "}
          মূলত ডেস্কটপে চালানোর জন্য তৈরি একটি ব্যবসার অ্যাপ—স্টক, বিক্রি, সরবরাহকারীর কাছ থেকে বাকিতে
          কেনা (মহাজন), আর গ্রাহকের ইনভয়েস—একই সূত্রে গুছিয়ে রাখতে। আপনি যা এন্ট্রি করবেন তা এই
          কম্পিউটারের SQLite ডেটাবেসে স্থানীয়ভাবে জমা হয়; দৈনন্দিন কাজের জন্য আলাদা ক্লাউড অ্যাকাউন্ট
          লাগে না, তাই চালানো হালকা থাকে আর হিসাবের নিয়ন্ত্রণ আপনার হাতেই থাকে। উপরের বিষয়ের ট্যাব থেকে
          গাইডের বাকি অংশে যান—প্রতিটি বিষয় সাইডবারের যে পেজের নাম, তার সঙ্গেই মিলিয়ে সাজানো।
        </p>
        <HelpSubSection title="মূল পেজগুলোতে কী কী পাবেন">
          <HelpBulletList
            items={[
              `${terms.navHome}: উপরের সারির সূচক—${terms.homeHeroMetricToday}, ${terms.homeHeroMetricThisWeek}, ${terms.homeHeroMetricThisMonth}, ${terms.homeHeroMetricLenderNet}; ${terms.homeSectionWeeklyMomentum}; তারিখের প্রিসেটসহ ${terms.homeSectionRangeComposition}; ${terms.homeSectionQuickActions} (${terms.qaCreateInvoice}, ${terms.qaCreditPurchase}); ${terms.qaCashVsExp}; ${terms.homeSectionLowStockAlerts}; ${terms.homeSectionWeeklyDetails}; আর ${terms.homeSectionLenderSummary}। প্রয়োজনে এখান থেকেই সংশ্লিষ্ট পেজে চলে যেতে পারবেন।`,
              `${terms.navUnits}: ${terms.unitsTabAll}, ${terms.unitsTabTypes} ও ${terms.unitsTabConv}—একই মাল কখনো কেজিতে, কখনো গ্রামে বা পিসে বিল/স্টক এন্ট্রি করলেও যেন হিসাব এক সূত্রে মিলে।`,
              `${terms.navStock}: পণ্যের ক্যাটালগ, হাতে কত আছে, রি-অর্ডারের ইঙ্গিত, পণ্যপ্রতি বিক্রির ডিফল্ট ও GST/HSN, পণ্য-ভিত্তিক একক রূপান্তর, ${terms.itemsAddStock} ও ${terms.itemsReduceStock}, সার্চ, এক্সপোর্ট ও প্রিন্ট।`,
              `${terms.navMahajans}: যাদের কাছ থেকে বাকিতে মাল নিয়ে পরে ${terms.txSettlementType} করবেন—ব্যালান্স, লেজার, এক্সপোর্ট। অ্যাপের মেনুতে নাম ${terms.navMahajans}; পুরনো ব্যাকআপ বা কোডের ভেতরে ইংরেজি লেবেল “mahajan” থাকতে পারে।`,
              `${terms.navTransactions}: এক জায়গায় ${terms.txAddCreditPurchase}, ${terms.txAddSettlement}, ${terms.txCashPurchase}, ফিল্টার, এক্সপোর্ট ও প্রিন্ট।`,
              `${terms.navSales}: ক্যালেন্ডারে প্রতিটি তারিখে একটি সারি—${terms.salesInvoiceSales} থেকে আসা মোট, ${terms.salesMiscCashSales}, ${terms.salesCashInHand} ও ${terms.salesExpenditure}।`,
              `${terms.navInvoices}: গ্রাহকের বিল, লাইন আইটেম; GST চালু থাকলে কর-সচেতন মোট; ${terms.navSettings} থেকে ছাড়ের নিয়ম; PDF ও প্রিন্ট—সবটাই ব্যবসার প্রোফাইল অনুযায়ী।`,
              `${terms.navTeam}: নাম ধরে সাইন-ইন, রোল, PIN ও অ্যাকাউন্ট চালু কিনা—যারা একই কম্পিউটার শেয়ার করেন (বিস্তারিত ${terms.navTeam} বিষয়ে)।`,
              `${terms.navSettings}: ব্যবসার পরিচয়, কর ও GST, ছাড়, চেহারা, নিরাপত্তা, কার্যকলাপ লগ আর ডেটা টুলস (ব্যাকআপ, রিস্টোর, রিসেট, স্যাম্পল ডেটা)।`,
              `${terms.navHelp}: এই পেজ—লাইভ স্ক্রিনের পাশাপাশি পড়ে নেওয়ার রেফারেন্স।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="এক অংশ আরেক অংশের সঙ্গে কীভাবে জড়িত">
          <p className="mb-2">
            একক ও এককের ধরন পণ্যের ভিত্তি; পণ্য ছাড়া ইনভয়েস বা স্টক চলাচল ঠিকমতো চলে না। মাল হাতে এলে{" "}
            {terms.txAddCreditPurchase} আর {terms.txCashPurchase} স্টক বাড়ায়। ইনভয়েস যে তারিখের, সেই
            দিনের {terms.salesInvoiceSales} হিসেবে যোগ হয় {terms.navSales}-এ। মহাজনের বাকিতে ক্রয় ও{" "}
            {terms.txSettlementType}{" "}
            শুধু বলে সরবরাহকারীর কাছে কত দেনা বা কত শোধ হল—কাউন্টারের নগদের খাতা একা এটায় মিলে না। দিন
            শেষে নগদ ও ছোটখাটো বিক্রি মিলিয়ে দেখতে {terms.navSales}; সেখানে {terms.salesMiscCashSales},{" "}
            {terms.salesCashInHand} ইত্যাদি থাকে।
          </p>
        </HelpSubSection>
      </div>
    ),

    "getting-started": (
      <div className="space-y-1">
        <HelpSubSection title="প্রথমবার চালু ও সাইন-ইন">
          <p className="mb-2">
            একদম নতুন ইনস্টলে আগে অনবোর্ডিং স্ক্রিন—কোম্পানির নাম ও ঠিকানা, ঐচ্ছিক GSTIN,{" "}
            {terms.roleOwner}-এর নাম ও ফোন, অ্যাপে যে নাম দেখাবে, তারপর চার অঙ্কের PIN আর মালিকের
            রিকভারি কী নিরাপদে সংরক্ষণ। শেষ হলেই মূল লেআউট খুলবে। কাজের মাঝখানে আবার লক করতে হেডারের{" "}
            {terms.lockApp} বা {terms.navSettings} → {terms.setSecurity} খুলুন; আনলক সবসময় যে
            ব্যবহারকারী এখন সাইন ইন, শুধু তার PIN দিয়ে। একই কম্পিউটারে কয়েকজন চালালে প্রত্যেকের জন্য
            আলাদা সাইন-ইন {terms.navTeam}-এ রাখুন—তাহলে {terms.navSettings} → {terms.setActivity} থেকে
            কার্যকলাপের লগে ধরা পড়ে কে কী বদলালেন।
          </p>
        </HelpSubSection>
        <HelpSubSection title="সেটআপের সুপারিশকৃত ক্রম">
          <p className="mb-2">
            তথ্য যেকোনো ক্রমেই দেওয়া যায়; তবে নিচের ক্রমে গেলে একই কাজ বারবার না ঠিক করতে হয়—আগে
            ব্যবসার পরিচয় ও করের নিয়ম, তারপর একক ও {terms.navStock}, শেষে দৈনন্দিন লেনদেনের ধারা।
          </p>
          <HelpStepList
            steps={[
              `${terms.navSettings} → ${terms.setBusiness} খুলে কোম্পানির নাম, ঠিকানা, GSTIN, মালিকের নাম ও ফোন সেভ করুন—এই তথ্য ইনভয়েস প্রিন্ট ও এক্সপোর্টে দেখায়।`,
              `GST যুক্ত বিল দিলে ${terms.navSettings} → ${terms.setTax}: GST চালু, ডিফল্ট স্ল্যাব, ইনক্লুসিভ না এক্সক্লুসিভ মূল্য, সরবরাহের স্থান, আর ঐচ্ছিক গ্রাহক GSTIN বা HSN কলাম। ইনভয়েস স্ক্রিন সরাসরি এই সেটিংস মেনে চলে।`,
              `একই ${terms.navSettings}-এ ${terms.setDiscounts} ঘুরে দেখুন—শতাংশ, ফ্ল্যাট, BOGO, কুপন, স্তর, রাউন্ডিং যা আসলে লাগে শুধু সেগুলো চালু রাখুন, যাতে ইনভয়েসে অপ্রয়োজনীয় ঝালমেলা না থাকে।`,
              `${terms.navUnits}: আগে ${terms.unitsTabTypes}-এ কয়েকটি ধরন (যেমন ভর, গণনা, আয়তন), তারপর ${terms.unitsTabAll}-এ প্রতিটি এককের নাম, ঐচ্ছিক প্রতীক ও ধরন বসান, শেষে বারবার লাগে এমন জোড়ার জন্য ${terms.unitsTabConv} যোগ করুন (যেমন kg ও g)।`,
              `${terms.navStock}-এ পণ্য তৈরি করুন—বেস একক, ঐচ্ছিক রি-অর্ডার লেভেল, রিটেইল বা অন্যান্য বিক্রির একক, প্রয়োজনে পণ্য-ভিত্তিক রূপান্তর, ঐচ্ছিক ডিফল্ট বিক্রিমূল্য ও বিক্রির একক, GST হার ও HSN—একবার সেভ করলে কাউন্টারে বিল তোলা সহজ হয়।`,
              `যাদের কাছ থেকে বাকিতে মাল নেন তাদের ${terms.navMahajans}-এ যোগ করুন; ${terms.txAddCreditPurchase} ও ${terms.txSettlementType} লিখুন ${terms.navTransactions} থেকে, বা নির্দিষ্ট মহাজনের লেজার খুলেও।`,
              `প্রতিদিনের কাজ: ${terms.navInvoices} ও ${terms.navSales}; চার্ট, সতর্কবার্তা ও মোটামুটি ছবি এক নজরে দেখতে ${terms.navHome}।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="ট্রায়াল মোড">
          <p>
            হেডারে {terms.trialBadge} ব্যাজ থাকলে বিল্ডটি সময়সীমাযুক্ত। মেয়াদ শেষে পূর্ণ ভার্সন কেনার
            নির্দেশ আসে; ট্রায়াল চলাকালে অ্যাপের কাজকর্ম আর বাকি আচরণ স্বাভাবিক ভার্সনের মতোই থাকে।
          </p>
        </HelpSubSection>
      </div>
    ),

    units: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {terms.navUnits}-এ তিনটি ট্যাব—{terms.unitsTabAll}, {terms.unitsTabTypes}, {terms.unitsTabConv}।
          এখানে যা সাজাবেন, তা পুরো অ্যাপ জুড়ে পরিমাণের ভাষা: কোন নাম ও প্রতীক দেখাবে, কোন এককগুলো একই
          ধরনের গণনায় মিলবে, আর ভিন্ন এককের মধ্যে গুণক কী হবে। {terms.navInvoices} বা স্টক চলাচলে লাইন
          লিখলে অ্যাপ এই নিয়মগুলোর সঙ্গে {terms.navStock}-এ পণ্যপ্রতি সেট করা{" "}
          {terms.itemsUnitsAndConversions} মিলিয়ে নেয়।
        </p>
        <HelpSubSection title={terms.unitsTabAll}>
          <p className="mb-2">
            এ তালিকার এককই পরে {terms.navStock}-এ পণ্যের সঙ্গে জুড়বে (যেমন কেজি, পিস, বাক্স, লিটার)।
            প্রতিটি সারিতে নাম, টেবিল বা PDF-এ ছোট করে দেখানোর জন্য ঐচ্ছিক প্রতীক, আর ঐচ্ছিক ধরন—ধরন
            দিলে শুধু সেই পরিবারের মধ্যেই {terms.unitsTabConv} যোগ করা যায়, যেন অসঙ্গত মাপ একসঙ্গে না
            বাঁধে।
          </p>
          <HelpStepList
            steps={[
              `সাইডবার থেকে ${terms.navUnits} খুলুন এবং ${terms.unitsTabAll} ট্যাবে থাকুন।`,
              `“${terms.unitsAddUnit}”-এ ক্লিক করে নাম ও প্রতীক লিখুন, প্রয়োজনে ধরন বাছাই করে সেভ করুন।`,
              `সারির কাজের মেনু থেকে সম্পাদনা করুন। মুছে ফেলা তখনই সম্ভব যখন অন্য কোথাও নির্ভরতা থাকে না; অ্যাপ যে কিছু একক আগে থেকেই দেয়, সেগুলো মুছতে দেবে না।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title={terms.unitsTabTypes}>
          <p className="mb-2">
            ধরন মানে হালকা গোষ্ঠী—ভর, আয়তন, গণনা বা আপনার ব্যবসায় যা লাগে। এগুলো নিজে থেকে কোনো হিসাব
            করে না; শুধু বলে দেয় কোন এককগুলো একই ধরনের, যাতে {terms.unitsTabConv}-এ ভুল করে ভরের সঙ্গে
            গণনার একক না জোড়ায়।
          </p>
          <HelpStepList
            steps={[
              `${terms.unitsTabTypes} ট্যাবে যান।`,
              `“${terms.unitsAddType}” দিয়ে নাম লিখে সেভ করুন, তারপর ${terms.unitsTabAll}-এ গিয়ে প্রতিটি এককে সেই ধরন লাগান।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title={terms.unitsTabConv}>
          <p className="mb-2">
            প্রতিটি সারিতে {terms.unitsColFromUnit}, {terms.unitsColToUnit} (দুটোই একই ধরনের হতে হবে) এবং{" "}
            {terms.unitsColFactor}—যেমন ১ kg = ১০০০ g। যে ঘরে {terms.unitsColFactor} লেখেন, সেটিই এই সম্পর্কের সংখ্যা। এই গ্লোবাল নিয়মের পাশাপাশি
            কোনো পণ্যের জন্য আলাদা গুণক লাগলে সেটা {terms.navStock}-এ, ওই পণ্যের {terms.itemsUnitsAndConversions}
            অংশে সারি যোগ করে ঠিক করতে হয়।
          </p>
          <HelpStepList
            steps={[
              `${terms.unitsTabConv} ট্যাব খুলুন।`,
              `“${terms.unitsAddConversion}”-এ ক্লিক করে একই ধরনের ${terms.unitsColFromUnit} ও ${terms.unitsColToUnit} বাছাই করুন, ${terms.unitsColFactor} লিখে সেভ করুন।`,
              `নতুন একক বা নতুন বিক্রির ধরন এলে এখানকার গুণকও আপডেট রাখুন; ভুল গুণক সাধারণত আগে ধরা পড়ে অস্বাভাবিক দর বা স্টকের ফারাক দিয়ে।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title={`${terms.navInvoices}-এ একক`}>
          <p>
            লাইনে পণ্য বাছাই করলে এককের তালিকা মূলত ওই পণ্যের {terms.itemsPrimaryStockUnit} এবং সেখানে যোগ
            করা বিক্রির অন্য এককগুলো থেকে আসে। {terms.unitsTabConv} ও পণ্যের নিজস্ব রূপান্তর মিলিয়ে
            পরিমাণ ও দর এক একক থেকে অন্য এককে ঠিকমতো গণনা হয়। ড্রপডাউনে একক দেখায় না মনে হলে আগে{" "}
            {terms.navStock}-এ ওই পণ্যের {terms.itemsUnitsAndConversions} খুলে দেখুন, তারপর{" "}
            {terms.navInvoices}-এ ফিরে আসুন।
          </p>
        </HelpSubSection>
      </div>
    ),

    products: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          পণ্য হল ক্যাটালগের ভিত—স্টকের মাত্রা, ইনভয়েসে ডিফল্ট আচরণ আর লো স্টক সতর্কতা সব এখান থেকেই
          চলে। একক ও কর-সংক্রান্ত ফিল্ড একবার ঠিক করে রাখলে কাউন্টারে বিল তোলা অনেক দ্রুত হয়।
        </p>
        <HelpSubSection title="পণ্য যোগ করা">
          <HelpStepList
            steps={[
              `${terms.navStock}-এ গিয়ে “${terms.itemsAddProduct}” ক্লিক করুন।`,
              `নাম ও ঐচ্ছিক কোড।`,
              `প্রাইমারি স্টক একক বাছুন।`,
              `ঐচ্ছিক বর্তমান স্টক ও রি-অর্ডার লেভেল।`,
              `রিটেইল/অন্যান্য এককে কীভাবে বিক্রি হয় তা লিখুন; নতুন পণ্য পুরনোটার মতো এককে চললে “${terms.itemsImportFromProduct}” ব্যবহার করুন।`,
              `গ্লোবাল স্ট্যান্ডার্ডের চেয়ে আলাদা হলে পণ্য-স্তরের রূপান্তর সারি যোগ করুন।`,
              `ঐচ্ছিক ডিফল্ট বিক্রিমূল্য ও বিক্রির একক, GST স্ল্যাব, HSN—লাইন প্রি-ফিল হয়, বিল প্রতি বদলানো যায়।`,
              `সেভ—তালিকায় পরিমাণ ও একক দেখায়।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="এডিট বা ডিলিট">
          <p className="mb-2">
            পেন্সিল আইকনে যেকোনো ফিল্ড বদলান। ডিলিট ইচ্ছাকৃতভাবে কঠিন রাখা হয়েছে— সাধারণত হাতে স্টক
            শূন্য আর কোনো বাধা না থাকলেই মুছবে, যেন পুরনো ইনভয়েস অজান্তে ভেঙে না যায়।
          </p>
        </HelpSubSection>
        <HelpSubSection title={`${terms.itemsAddStock} / ${terms.itemsReduceStock}`}>
          <HelpStepList
            steps={[
              `${terms.itemsAddStock}: পণ্য, পরিমাণ (প্রয়োজনে একক) নিশ্চিত করে জমা দিন—হাতে স্টক বাড়ে; যে কেনা মহাজন বা নগদ ক্রয় হিসেবে লিখছেন না, ওপেনিং ব্যালান্স বা সংশোধনের জন্য এটা ব্যবহার করুন।`,
              `${terms.itemsReduceStock}: একই ধরনের ফ্লো—খোঁটা, দোকানের নিজস্ব ব্যবহার বা ইনভয়েস ছাড়া বিক্রি। হাতে যা আছে তার বেশি কমানো যাবে না।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="সার্চ ও পেজিনেশন">
          <p>
            সার্চ নাম বা কোডে। পেজিনেশন বড় ক্যাটালগকে চলমান রাখে; এক্সপোর্টের আগে ফিল্টার প্রযোজ্য।
          </p>
        </HelpSubSection>
        <HelpSubSection title="এক্সপোর্ট ও প্রিন্ট">
          <p>
            এক্সপোর্টে CSV ও PDF স্ন্যাপশট; প্রিন্ট চলমান টেবিল ভিউ সিস্টেম ডায়ালগে পাঠায়। তালিকার
            সময়-নির্দিষ্ট ব্যাকআপ হিসেবে ব্যবহার করুন; মেশিন বদলের জন্য পূর্ণ ফাইডেলিটিতে{" "}
            {terms.navSettings} → {terms.setData}-এর ডাটাবেস এক্সপোর্টের বিকল্প নয়।
          </p>
        </HelpSubSection>
      </div>
    ),

    lenders: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          মহাজন হল যে পক্ষের কাছ থেকে বাকিতে মাল নিয়ে পরে নগদ/ব্যাংক/UPI/চেক দিয়ে পরিশোধ করেন।
          ব্যালান্স ওই দুই ধরনের লেনদেন থেকে গড়ায়; খোলা বাজারের নগদ ক্রয় আলাদাভাবে{" "}
          {terms.navTransactions} → {terms.txCashPurchase}-এ।
        </p>
        <HelpSubSection title="মহাজন যোগ করা">
          <HelpStepList
            steps={[
              `${terms.navMahajans}-এ গিয়ে হিরোতে “${terms.mahajanAdd}” ক্লিক করুন।`,
              `নাম, ঐচ্ছিক ফোন, ঠিকানা, GSTIN।`,
              `সেভ—ডিরেক্টরিতে সার্চযোগ্য সারি।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="হিরো মেট্রিক ও আপডেট">
          <p className="mb-2">
            উপরের কার্ডে কতজন মহাজন, মোট বাকিতে ক্রয়, মোট {terms.txSettlementType} ও নেট ব্যালান্স।
            অন্য জায়গায় লেজার চলার পর মোট বদলাতে পারে—হিরোতে “{terms.mahajanFetchLatest}” দিয়ে পুরো অ্যাপ
            না খুলে আপডেট নিন।
          </p>
        </HelpSubSection>
        <HelpSubSection title="ডিরেক্টরিতে ব্যালান্স">
          <HelpBulletList
            items={[
              `“${terms.mahajanShowBalance}” বন্ধ থাকলে সারি প্রতি চাহিদামতো “${terms.mahajanViewBalance}” দিয়ে একজনের ব্যালান্স টানতে পারেন—বড় তালিকায় উপকারী।`,
              `সার্চ বারে “${terms.mahajanShowBalance}” চালু করলে এক ব্যাচে সব মহাজনের ব্যালান্স—সামান্য ভারী কোয়েরি, তবে সার্বিক ছবি পরিষ্কার।`,
              `ধনাত্মক ব্যালান্স মানে মহাজনের কাছে এখনও দেনা; ঋণাত্মক মানে তারা আপনার কাছে পাওনা—${terms.navHome}-এর রঙের ভাষার মতোই।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="লেজার">
          <p className="mb-2">
            নাম বা লেজার অ্যাকশন দিয়ে মহাজন খুলুন। ভিতরে নতুন বাকিতে ক্রয় বা পরিশোধ, ধরন ও তারিখ
            ফিল্টার, এক্সপোর্ট/প্রিন্ট—এক সরবরাহকারী মিলাতে গ্লোবাল {terms.navTransactions} খুঁজে বের
            করার চেয়ে দ্রুত।
          </p>
        </HelpSubSection>
        <HelpSubSection title="মডালে কী যায় (সংক্ষেপে)">
          <p className="mb-2">
            বাকিতে ক্রয়ের লাইনে GST হার ও ইনক্লুসিভ/এক্সক্লুসিভ, ঐচ্ছিক সরবরাহকারীর ইনভয়েস নম্বর,
            ইনভয়েস ফাইল আপলোড, নোট, আর ঐচ্ছিক “এখনই পরিশোধ” অংশ—পেমেন্ট মেথড ও রেফারেন্স (নগদ রসিদ,
            UPI, UTR, চেক নং ইত্যাদি)। এক স্ক্রিনে মাল এল আর সাথে সাথে আংশিক টাকা (₹) দিলেও ধরা যায়।
          </p>
          <p>
            পরিশোধে টাকা (₹), তারিখ, পেমেন্ট মেথড, রেফারেন্স, ঐচ্ছিক নোট—এবং বরাদ্দ খুললে কোন বাকিতে
            ক্রয়ের কতটা বসল তা। শুধু এক খণ্ড পরিশোধ চাইলে বরাদ্দ ছাড়াই দেওয়া যায়।
          </p>
        </HelpSubSection>
        <HelpSubSection title="এক্সপোর্ট ও প্রিন্ট">
          <p>
            ডিরেক্টরি থেকে তালিকার এক্সপোর্ট/প্রিন্ট; লেজারের ভিতরে ফিল্টার করা ভিউতেই এক্সপোর্ট বা
            প্রিন্ট প্রযোজ্য।
          </p>
        </HelpSubSection>
      </div>
    ),

    transactions: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {terms.navTransactions} হল মহাজনের ব্যালান্স বা সাথে সাথে নগদে মাল কেনা—সব রেজিস্টার। প্রতিটি
          মহাজনের লেজারের পরিপূরক; কাজ যেটা সুবিধা সেটা খুলুন।
        </p>
        <HelpSubSection title={terms.txAddCreditPurchase}>
          <HelpStepList
            steps={[
              `“${terms.txAddCreditPurchase}” ক্লিক করুন।`,
              `মহাজন ও লেনদেনের তারিখ বাছুন।`,
              `লাইন: পণ্য, পরিমাণ, টাকার (₹) পরিমাণ—GST থাকলে লাইন প্রতি হার ও ইনক্লুসিভ/এক্সক্লুসিভ।`,
              `ঐচ্ছিক সরবরাহকারীর ইনভয়েস নম্বর, স্ক্যান/ছবি, নোট, আর অংশীদার টাকা (₹) এখনই পরিশোধ—মেথড ও রেফারেন্সসহ।`,
              `নিশ্চিত করুন—পাওয়া মাল অনুযায়ী স্টক বাড়ে।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title={terms.txAddSettlement}>
          <HelpStepList
            steps={[
              `“${terms.txAddSettlement}” ক্লিক করুন।`,
              `মহাজন, তারিখ, টাকা (₹), পেমেন্ট মেথড ও রেফারেন্স।`,
              `ঐচ্ছিক বরাদ্দ খুলে নির্দিষ্ট বাকিতে ক্রয়ের সাথে মিলিয়ে দিন।`,
              `সেভ—পরিশোধের টাকায় মহাজনের ব্যালান্স কমে।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title={terms.txCashPurchase}>
          <HelpStepList
            steps={[
              `“${terms.txCashPurchase}” ক্লিক করুন।`,
              `তারিখ ও লাইনে পণ্য, পরিমাণ, টাকা (₹)।`,
              `সেভ—স্টক বাড়ে, মহাজনের ব্যালান্সে হাত দেয় না—খোলা বাজারের নামহীন কেনার পথ।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="ফিল্টার, এডিট, এক্সপোর্ট">
          <p>
            মহাজন ও ধরন (সব / শুধু বাকিতে ক্রয় / শুধু পরিশোধ / শুধু নগদ ক্রয়) দিয়ে তালিকা সরু করুন। সারি
            অ্যাকশনে ব্যবসার নিয়ম মেনে এডিট বা ডিলিট। এক্সপোর্ট ও প্রিন্ট চালু থাকা ফিল্টার অনুযায়ী
            হয়—এক মহাজন বা এক ধরনের স্টেটমেন্ট বের করা সহজ হয়।
          </p>
        </HelpSubSection>
      </div>
    ),

    "daily-sales": (
      <div className="space-y-1">
        <HelpSubSection title="রেজিস্টারের উদ্দেশ্য">
          <p>
            {terms.navSales} দিন শেষের হিসাব এক জায়গায় রাখে। <strong>{terms.salesInvoiceSales}</strong>{" "}
            ওই দিনের সব ইনভয়েস থেকে স্বয়ংক্রিয়ভাবে যোগ হয়। <strong>{terms.salesMiscCashSales}</strong>{" "}
            হল ইনভয়েস ছাড়াই কাউন্টারে বা ছোটখাটোভাবে হওয়া বিক্রি। <strong>মোট বিক্রি</strong> এই দুই
            অংশের যোগফল। <strong>{terms.salesCashInHand}</strong> হল কাউন্টারে গণনা করা নগদ;{" "}
            <strong>{terms.salesExpenditure}</strong> দিনের খরচ। এটা পূর্ণ ডাবল-এন্ট্রি বই নয়, তবে
            নগদ আর বিল করা বিক্রির মিলিয়ে সৎ ছবি দেয়।
          </p>
        </HelpSubSection>
        <HelpSubSection title="দিন যোগ বা আপডেট">
          <HelpStepList
            steps={[
              `${terms.navSales} → “${terms.salesAddSale}”।`,
              `বিক্রির তারিখ বাছুন। ইনভয়েস থাকলে ${terms.salesInvoiceSales} কেবল পড়ার মোডে পূরণ হয়।`,
              `${terms.salesMiscCashSales}, ${terms.salesCashInHand}, ঐচ্ছিক ${terms.salesExpenditure} ও নোট লিখুন।`,
              `সেভ করলে এক তারিখে একটি সারি থাকে; একই তারিখে আবার সেভ হলে নতুন সারি নয়, আগেরটাই আপডেট হয়।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="ইনভয়েসে ড্রিল">
          <p>
            {terms.salesInvoiceSales} শূন্য না হলে সারির অ্যাকশন দিয়ে সেই তারিখ ফিল্টার করা ইনভয়েসে
            চলে যান—নাম ভুল বা বিল বাতিল দেখে নিতে সুবিধা।
          </p>
        </HelpSubSection>
        <HelpSubSection title="ফিল্টার, এডিট, এক্সপোর্ট">
          <p>
            শুরু/শেষ তারিখ গ্রিড স্কোপ করে; পেজিনেশন লম্বা ইতিহাসে। দিন ভুল লিখলে এডিট/ডিলিট। CSV/PDF
            এক্সপোর্ট বা প্রিন্ট একই ফিল্টার মানে মাস শেষে প্যাক ধারাবাহিক।
          </p>
        </HelpSubSection>
      </div>
    ),

    invoices: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          ইনভয়েস হল তারিখযুক্ত বাণিজ্যিক কাগজ। ফর্মটি প্রতিটি পণ্য থেকে ডিফল্ট (GST, HSN, বিক্রির
          ইঙ্গিত) আনে, তবু একই বিলে লাইন প্রতি বদল চালু থাকে।
        </p>
        <HelpSubSection title="ইনভয়েস তৈরি">
          <HelpStepList
            steps={[
              `${terms.navInvoices} → “${terms.invoicePageCreate}”।`,
              `ইনভয়েস নম্বর (ঐচ্ছিক), গ্রাহকের নাম, PDF-এ চাইলে ফোন/ঠিকানা।`,
              `লাইন: পণ্য, পরিমাণ, বিলিং একক, দর। “টোটাল” মোডে লাইন মোট লিখে ইউনিট প্রতি দর বের করতে পারেন।`,
              `${terms.navSettings}-এ যা ছাড় চালু আছে শুধু সেগুলো অর্ডার-স্তরে কুপন বা ছাড়।`,
              `সেভ—পরে এডিট, PDF বা প্রিন্ট।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="GST, HSN ও গ্রাহক-মুখী আউটপুট">
          <p className="mb-2">
            {terms.navSettings} → {terms.setTax} চালু আর লাইনে ধনাত্মক GST হার থাকলে ইনভয়েস ভিউ ও
            PDF-তে ট্যাক্সযোগ্য মূল্য CGST/SGST কলামে, ইনক্লুসিভ/এক্সক্লুসিভ মেনে। HSN কলাম সেটিং ও
            লাইনে কোড থাকলে দেখায়। গ্রাহক GSTIN ধরা ও চালু থাকলে B2B বিলে লাগে।
          </p>
        </HelpSubSection>
        <HelpSubSection title="দেখা, এডিট, প্রিন্ট">
          <p>
            রেজিস্টারে চোখ আইকন রিড-অনলি, পেন্সিল এডিট, প্রিন্ট/PDF গ্রাহক কপি। হেডার ব্র্যান্ডিং{" "}
            {terms.navSettings} → {terms.setBusiness} ও {terms.setAppearance} (ছোট প্রদর্শন নাম ও
            একসেন্ট রঙ) থেকে।
          </p>
        </HelpSubSection>
        <HelpSubSection title={`${terms.navSales}-এর সাথে যোগসূত্র`}>
          <p>
            ইনভয়েস তৈরি, বদল বা ডিলিট হলে ওই তারিখের {terms.salesInvoiceSales} {terms.navSales}-এ নতুন
            করে গণনা হয়—আলাদা কোনো লিঙ্ক লাগে না। দিন ভুল মনে হলে আগে ইনভয়েস ঠিক করুন, তারপর{" "}
            {terms.navSales} দেখে নিন।
          </p>
        </HelpSubSection>
      </div>
    ),

    team: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          সাইডবার থেকে {terms.navTeam} খুলুন (লাইভ অ্যাপে {terms.navInvoices} এর পর, {terms.navSettings}{" "}
          এর আগে)। টিম মেম্বার টেবিলে কে আনলক করতে পারে, কোন রোল, অ্যাকাউন্ট চালু কিনা। চার অঙ্কের
          PIN সবসময় ব্যবহারকারী প্রতি; লক হেডার বা {terms.navSettings} → {terms.setSecurity} থেকে।
        </p>
        <HelpSubSection title="কেন আছে">
          <p>
            শেয়ার্ড কাউন্টারে নামযুক্ত অপারেটর দরকার—কার্যকলাপ লগে কে দাম বদলাল, লাইন বাতিল করল বা
            ডেটা এক্সপোর্ট করল দেখায়। একাই মেশিন চালালে এক অ্যাকাউন্টেই থাকতে পারেন, যতক্ষণ না
            জবাবদিহি বা স্টাফের সীমিত রোল লাগে।
          </p>
        </HelpSubSection>
        <HelpSubSection title="রোল">
          <p className="mb-2">
            <strong>{terms.roleOwner}</strong> অনবোর্ডিংয়ের প্রথম অ্যাকাউন্ট; তালিকায় সারি মালিক
            হিসেবে চিহ্নিত। মালিককে এখানে নিষ্ক্রিয় করা যায় না; অন্য সাইন-ইন থাকলে মালিক সারিতে
            PIN রিসেট/নিষ্ক্রিয়/নামবদলের প্রশাসনিক অ্যাকশন লাগে না—মাস্টার অ্যাকাউন্ট লকআউট এড়াতে।
          </p>
          <p className="mb-2">
            <strong>{terms.roleAdmin}</strong> ব্যবহারকারী যোগ করতে, {terms.roleMember} রোল দিতে,
            পরিচালিত লোকের নাম বদলাতে, অন্যের PIN রিসেট ও অ্যাকাউন্ট চালু/বন্ধ করতে পারেন। শুধু{" "}
            {terms.roleOwner} আরেকজন {terms.roleAdmin} বানাতে পারেন। {terms.roleAdmin} কখনও মালিক
            সারিতে প্রশাসনিক অ্যাকশন পায় না।
          </p>
          <p>
            <strong>{terms.roleMember}</strong> PIN দিয়ে আনলকের পর দৈনিক ব্যবসার পেজ—স্টক, ইনভয়েস,
            মহাজন ইত্যাদি। নিজের সারিতে “নাম পরিবর্তন” সব সাইন-ইন ব্যবহার করতে পারে; নীতি মেনে
            ম্যানেজার অন্যের সারিতেও।
          </p>
        </HelpSubSection>
        <HelpSubSection title="কাউকে যোগ করা">
          <HelpStepList
            steps={[
              `${terms.roleOwner} বা ${terms.roleAdmin} হয়ে ${terms.navTeam} খুলে “${terms.usersAddUser}” (অনুমতি থাকলে হিরোর বোতাম)।`,
              `প্রদর্শন নাম, ${terms.roleMember} বা ${terms.roleAdmin} (${terms.roleAdmin} শুধু ${terms.roleOwner}-এর জন্য), আর টেম্পোরারি চার অঙ্কের PIN।`,
              `তৈরির পর টেম্প PIN গোপনে দিন। পরের লগইনে স্থায়ী PIN বাধ্য—টেম্প. PIN ব্যাজ চলে যতক্ষণ না শেষ হয়।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="PIN রিসেট ও সক্রিয়তা">
          <p className="mb-2">
            PIN রিসেট সংক্ষিপ্ত ফ্লো: নিশ্চিত করুন, নতুন টেম্পোরারি চার অঙ্ক দিন—প্রভাবিত ব্যবহারকারী
            পরের সাইন-ইনে স্থায়ী PIN বাছবে। PIN ভুললে বা পুরনো জ্ঞান প্রত্যাহার করতে ব্যবহার করুন।
          </p>
          <p>
            নিষ্ক্রিয় সাইন-ইন বন্ধ, ইতিহাস মুছে না; সক্রিয় ফেরায়। নিজের সারি সাইন-ইন থাকা অবস্থায়
            নিষ্ক্রিয় করা যায় না; মালিক সারি এখানে টগল বন্ধ যায় না। শেয়ার্ড ডেস্ক থেকে উঠলে সাথে সাথে
            লক অভ্যাস করুন।
          </p>
        </HelpSubSection>
        <HelpSubSection title={`${terms.navTeam} বনাম ${terms.navSettings}`}>
          <p>
            {terms.navTeam} পরিচয়—নাম, রোল, PIN জীবনচক্র, কে আনলক করতে পারে। {terms.navSettings}{" "}
            ব্যবসার নিয়ম, চেহারা, কর ও ছাড় নীতি, নিরাপত্তা পছন্দ (যেমন রিকভারি কী), কার্যকলাপ লগ দেখা,
            এই ইনস্টলের ডাটাবেস ব্যাকআপ পথ। ল্যাপটপ হস্তান্তরে দুটোই কোথায় তা লিখে রাখুন।
          </p>
        </HelpSubSection>
      </div>
    ),

    reports: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {terms.navHome} ড্যাশবোর্ড হল উপরের স্তরের বিশ্লেষণ—যে লেনদেন, ইনভয়েস, দৈনিক বিক্রি ও স্টকের
          টেবিলে আপনি বিস্তারিত রাখেন, সেই ডেটা থেকে মোটামুটি ছবি তুলে ধরে, যাতে প্রতিবার স্প্রেডশিট
          না গুটিয়েও দ্রুত সিদ্ধান্ত নিতে পারেন।
        </p>
        <HelpSubSection title="KPI স্ট্রিপ">
          <p className="mb-2">
            উপরের সারিটাই “এখন কেমন চলছে?”—আজকের বিক্রি, এই সপ্তাহ ও মাসের বিক্রি ও খরচ, আর মহাজনের
            নেট (বাকিতে ক্রয় থেকে পরিশোধ বাদ দিলে যা দাঁড়ায়)। বড় সংখ্যা {terms.navSettings} →{" "}
            {terms.setAppearance}-এ যে সংখ্যা সংক্ষেপের ধরন বেছে রেখেছেন (ভারতীয় লাখ/কোটি, US M/B, বা
            SI K/M/B) সেই ফরম্যাটেই এখানেও দেখায়।
          </p>
        </HelpSubSection>
        <HelpSubSection title="৭ দিনের বিক্রি মোমেন্টাম">
          <p className="mb-2">
            সপ্তাহের শেষ তারিখ বেছে নিয়ে সাত দিনের বিক্রি ও খরচের চার্ট দেখুন—সাপ্তাহিক মোট, কোন দিনে
            সর্বোচ্চ বিক্রি, আর কতগুলো দৈনিক সারি মিলিয়ে গ্রাফ তৈরি হয়েছে। নিয়মিত শান্ত দিনগুলোর
            প্যাটার্ন, উৎসবের সময় হঠাৎ চাপ, আর অপ্রত্যাশিত খরচ—সব একসাথে চোখে পড়ে।
          </p>
        </HelpSubSection>
        <HelpSubSection title="রেঞ্জ কম্পোজিশন">
          <p className="mb-2">
            শুরু ও শেষ তারিখ নিজে দিন, নয়তো প্রিসেট (এই সপ্তাহ, এই মাস, শেষ ৩০ দিন, এই বছর…)। চার্টে{" "}
            {terms.salesInvoiceSales}, {terms.salesMiscCashSales} আর খরচ স্তূপ হয়—বিক্রির ধাক্কা বেশি
            ফর্মাল বিল থেকে এসেছে নাকি কাউন্টারের নগদ থেকে, তা বোঝা সহজ হয়।
          </p>
        </HelpSubSection>
        <HelpSubSection title="কুইক অ্যাকশন">
          <p className="mb-2">
            দুটি বড় বোতাম সরাসরি {terms.qaCreateInvoice} ({terms.navInvoices}-এ নতুন খসড়া) ও{" "}
            {terms.qaCreditPurchase} ({terms.navTransactions}-এ বাকিতে ক্রয় ফ্লো) খোলে। নিচে{" "}
            {terms.qaCashVsExp} কার্ড একই সাত দিনের জানালায় নগদ স্বাস্থ্য দ্রুত চেক করে।
          </p>
        </HelpSubSection>
        <HelpSubSection title="লো স্টক সতর্কতা">
          <p className="mb-2">
            রি-অর্ডার লেভেলে বা তার নিচের ক্যাটালগ সারি। জীবন্ত পুনঃস্টক সারি—ক্লিক করলে{" "}
            {terms.navStock}-এ গিয়ে পরিমাণ বাড়ান বা থ্রেশহোল্ড বদলান।
          </p>
        </HelpSubSection>
        <HelpSubSection title="সাপ্তাহিক বিক্রি বিস্তারিত">
          <p className="mb-2">
            সাত দিনের টেবিল (নতুন তারিখ আগে)—{terms.homeWeeklyTableSale}, {terms.homeWeeklyTableInvoice},{" "}
            {terms.homeWeeklyTableMisc}, {terms.homeWeeklyTableCashInHand}, {terms.homeWeeklyTableExpenditure}।
            নির্বাচিত জানালার জন্য {terms.navSales} পেজের সারির সাথে মিলিয়ে KPI চার্টের সংখ্যা যাচাই
            করতে পারেন।
          </p>
        </HelpSubSection>
        <HelpSubSection title="মহাজন সারাংশ">
          <p className="mb-2">
            বাকিতে ক্রয়, পরিশোধ ও নেট ব্যালান্স একত্রে—কতজন আপনার কাছে পাওনা বনাম আপনি কতজনের কাছে
            দেনা। রঙের ইঙ্গিত KPI স্ট্রিপের মতো—দেনা জমা হওয়ার আগেই সাজান।
          </p>
        </HelpSubSection>
      </div>
    ),

    "settings-data": (
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {terms.navSettings}-এ {terms.navHelp}-এর মতো সেগমেন্ট: {terms.setBusiness}, {terms.setTax},{" "}
          {terms.setDiscounts}, {terms.setAppearance}, {terms.setSecurity}, {terms.setActivity}, {terms.setData}। কর ও ছাড়ের টগলই নির্ধারক—ইনভয়েসের পর্দায় শুধু যা চালু সেটাই দেখায়, অপ্রয়োজনীয় অপশন লুকিয়ে থাকে।
        </p>
        <HelpSubSection title={terms.setBusiness}>
          <p>
            PDF-এর আইনি পরিচয় ব্লক: কোম্পানির নাম, ঠিকানা, GSTIN, মালিকের নাম, ফোন। মৌসুমের বাইরে
            গ্রাহক কাগজ পাঠানোর আগে আপডেট রাখুন।
          </p>
        </HelpSubSection>
        <HelpSubSection title={terms.setTax}>
          <p>
            GST মাস্টার সুইচ, ডিফল্ট স্ল্যাব, ইনক্লুসিভ বনাম এক্সক্লুসিভ, সরবরাহের স্থান, ঐচ্ছিক গ্রাহক
            GSTIN ফিল্ড, HSN কলাম আচরণ। বড় সুইচ মাঝপথে বদলালে খোলা ইনভয়েস পর্যালোচনা করুন।
          </p>
        </HelpSubSection>
        <HelpSubSection title={terms.setDiscounts}>
          <p>
            দোকানে কোন ছাড়ের যন্ত্র আছে বাছুন—শতাংশ, ফ্ল্যাট, BOGO, কুপন টেবিল, স্তর বা পরিমাণভিত্তিক,
            শেষ বিল রাউন্ডিং। যা লাগে না তা বন্ধ রাখলে ইনভয়েসে সেই অংশ দেখায় না—গোছানো পর্দা আর ভুল
            কমে।
          </p>
        </HelpSubSection>
        <HelpSubSection title={terms.setAppearance}>
          <p className="mb-2">
            ছোট প্রদর্শন নাম (হেডার ও হালকা PDF ব্র্যান্ডিং), একসেন্ট রঙ, ড্যাশবোর্ড ও টেবিলের গ্লোবাল
            সংখ্যা সংক্ষিপ্ত রূপ।
          </p>
          <p>
            লাইট/ডার্ক/সিস্টেম থিম সাইডবার ফুটারেও; দুই জায়গা একই পছন্দ লিখে।
          </p>
        </HelpSubSection>
        <HelpSubSection title={terms.setSecurity}>
          <p>
            PIN বদলান, রিকভারি মাস্টার কী রাখুন, তৎক্ষণাৎ ওয়ার্কস্টেশন লক। শেয়ার্ড কাউন্টারে উঠে যাওয়া
            মানে লক করা সঠিক অভ্যাস।
          </p>
        </HelpSubSection>
        <HelpSubSection title={terms.setActivity}>
          <p>
            গুরুত্বপূর্ণ ঘটনার অ্যাপেন্ড-স্টাইল লগ—কে কী করল কখন। {terms.navTeam}-এ নামযুক্ত সাইন-ইনের
            সাথে জোড়া দিলে জবাবদিহি স্পষ্ট হয়; আইনি হিসাবের লেজারের বদলি নয়, তবু দোকানের ভিতরের ঝামেলা
            দ্রুত খুঁজে বের করতে সাহায্য করে।
          </p>
        </HelpSubSection>
        <HelpSubSection title={terms.setData}>
          <HelpBulletList
            items={[
              `ডাটাবেস এক্সপোর্ট: পুরো SQLite কপি—হার্ডওয়্যার বদল বা ঝুঁকিপূর্ণ পরীক্ষার আগে পূর্ণ-ফাইডেলিটি ব্যাকআপ।`,
              `ডাটাবেস ইমপোর্ট: বেছে নেওয়া ফাইল লাইভ ডেটাবেস বদলায়; আগে এই মেশিনে এক্সপোর্ট করুন।`,
              `সব ডেটা মুছুন: স্কিমা রেখে ব্যবসার সারি পরিষ্কার—আনইনস্টল ছাড়া ক্লিন স্লেট।`,
              `ডাটাবেস রিসেট: ফাইল মুছে খালি তৈরি—এক্সপোর্ট ছাড়া সম্পূর্ণ হারানো।`,
              `স্যাম্পল ডেটা: খালি ডেটাসেট শনাক্ত হলে ডেমো মহাজন, পণ্য, ইনভয়েস, ট্রানজ্যাকশন ও দৈনিক বিক্রি ঢোকায় যাতে প্রশিক্ষণে নিরাপদে ক্লিক করা যায়।`,
            ]}
          />
        </HelpSubSection>
        <HelpSubSection title="ডাটাবেস পাথ">
          <p>
            ডেটা ট্যাবে SQLite ফাইলের ডিস্ক লোকেশন দেখায়—টাইম মেশিন, কোম্পানি সিঙ্ক, এনক্রিপ্টেড ড্রাইভের
            সাথে ইন-অ্যাপ এক্সপোর্টের পাশাপাশি ব্যাকআপ নীতিতে ঢুকান।
          </p>
        </HelpSubSection>
      </div>
    ),
  };
}
