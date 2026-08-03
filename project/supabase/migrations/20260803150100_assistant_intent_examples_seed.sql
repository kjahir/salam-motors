/*
# Seed intent examples for Ask Salam multilingual routing

Reference phrases only - no user or business content. Each row is an example of how a
question for that intent is actually phrased in that locale.

Embeddings are left NULL; the edge function fills them on first use, because a migration
cannot call an embedding model.

## Translation quality
The English rows are authoritative. The other five locales were authored without a native
speaker's review, and unnatural phrasing here degrades quietly - it does not break anything,
it just fails to match, and the turn falls back to the model routing round exactly as it
does today. Reviewing and correcting these rows is the cheapest available improvement to
non-English latency, and can be done with an UPDATE rather than a deploy.

## Data handling
Inserts reference rows into public.assistant_intent_examples only. Idempotent via the
(intent, locale, phrase) unique constraint.
*/

insert into public.assistant_intent_examples (intent, locale, phrase) values
  ('inventory_listing', 'en-IN', 'which bikes are unsold'),
  ('inventory_listing', 'en-IN', 'show me the cars in stock'),
  ('inventory_listing', 'en-IN', 'how many vehicles are available'),
  ('inventory_listing', 'en-IN', 'list the current inventory'),
  ('inventory_listing', 'hi-IN', 'कौन सी बाइक बिकी नहीं है'),
  ('inventory_listing', 'hi-IN', 'स्टॉक में कौन सी गाड़ियाँ हैं'),
  ('inventory_listing', 'hi-IN', 'कितने वाहन उपलब्ध हैं'),
  ('inventory_listing', 'hi-IN', 'मौजूदा इन्वेंटरी दिखाओ'),
  ('inventory_listing', 'ta-IN', 'எந்த பைக்குகள் விற்கப்படவில்லை'),
  ('inventory_listing', 'ta-IN', 'கையிருப்பில் உள்ள கார்களைக் காட்டு'),
  ('inventory_listing', 'ta-IN', 'எத்தனை வாகனங்கள் உள்ளன'),
  ('inventory_listing', 'ta-IN', 'தற்போதைய சரக்கு பட்டியலைக் காட்டு'),
  ('inventory_listing', 'te-IN', 'ఏ బైకులు అమ్ముడు కాలేదు'),
  ('inventory_listing', 'te-IN', 'స్టాక్‌లో ఉన్న కార్లు చూపించు'),
  ('inventory_listing', 'te-IN', 'ఎన్ని వాహనాలు అందుబాటులో ఉన్నాయి'),
  ('inventory_listing', 'te-IN', 'ప్రస్తుత ఇన్వెంటరీ చూపించు'),
  ('inventory_listing', 'kn-IN', 'ಯಾವ ಬೈಕ್‌ಗಳು ಮಾರಾಟವಾಗಿಲ್ಲ'),
  ('inventory_listing', 'kn-IN', 'ಸ್ಟಾಕ್‌ನಲ್ಲಿರುವ ಕಾರುಗಳನ್ನು ತೋರಿಸಿ'),
  ('inventory_listing', 'kn-IN', 'ಎಷ್ಟು ವಾಹನಗಳು ಲಭ್ಯವಿವೆ'),
  ('inventory_listing', 'kn-IN', 'ಪ್ರಸ್ತುತ ದಾಸ್ತಾನು ತೋರಿಸಿ'),
  ('inventory_listing', 'ml-IN', 'ഏതു ബൈക്കുകൾ വിറ്റിട്ടില്ല'),
  ('inventory_listing', 'ml-IN', 'സ്റ്റോക്കിലുള്ള കാറുകൾ കാണിക്കൂ'),
  ('inventory_listing', 'ml-IN', 'എത്ര വാഹനങ്ങൾ ലഭ്യമാണ്'),
  ('inventory_listing', 'ml-IN', 'നിലവിലെ ഇൻവെന്ററി കാണിക്കൂ'),
  ('ageing_stock', 'en-IN', 'which vehicles have been sitting longest'),
  ('ageing_stock', 'en-IN', 'show me ageing stock'),
  ('ageing_stock', 'en-IN', 'what is the oldest stock'),
  ('ageing_stock', 'en-IN', 'which cars are slow moving'),
  ('ageing_stock', 'hi-IN', 'कौन सी गाड़ियाँ सबसे लंबे समय से पड़ी हैं'),
  ('ageing_stock', 'hi-IN', 'पुराना स्टॉक दिखाओ'),
  ('ageing_stock', 'hi-IN', 'सबसे पुराना स्टॉक कौन सा है'),
  ('ageing_stock', 'hi-IN', 'कौन सी कारें धीमी बिक रही हैं'),
  ('ageing_stock', 'ta-IN', 'எந்த வாகனங்கள் நீண்ட நாட்களாக உள்ளன'),
  ('ageing_stock', 'ta-IN', 'பழைய சரக்கைக் காட்டு'),
  ('ageing_stock', 'ta-IN', 'மிகப் பழைய சரக்கு எது'),
  ('ageing_stock', 'ta-IN', 'எந்த கார்கள் மெதுவாக விற்கின்றன'),
  ('ageing_stock', 'te-IN', 'ఏ వాహనాలు ఎక్కువ కాలంగా ఉన్నాయి'),
  ('ageing_stock', 'te-IN', 'పాత స్టాక్ చూపించు'),
  ('ageing_stock', 'te-IN', 'అత్యంత పాత స్టాక్ ఏది'),
  ('ageing_stock', 'te-IN', 'ఏ కార్లు నెమ్మదిగా అమ్ముడవుతున్నాయి'),
  ('ageing_stock', 'kn-IN', 'ಯಾವ ವಾಹನಗಳು ಹೆಚ್ಚು ದಿನಗಳಿಂದ ಇವೆ'),
  ('ageing_stock', 'kn-IN', 'ಹಳೆಯ ದಾಸ್ತಾನು ತೋರಿಸಿ'),
  ('ageing_stock', 'kn-IN', 'ಅತ್ಯಂತ ಹಳೆಯ ಸ್ಟಾಕ್ ಯಾವುದು'),
  ('ageing_stock', 'kn-IN', 'ಯಾವ ಕಾರುಗಳು ನಿಧಾನವಾಗಿ ಮಾರಾಟವಾಗುತ್ತಿವೆ'),
  ('ageing_stock', 'ml-IN', 'ഏതു വാഹനങ്ങൾ ഏറെ നാളായി കിടക്കുന്നു'),
  ('ageing_stock', 'ml-IN', 'പഴയ സ്റ്റോക്ക് കാണിക്കൂ'),
  ('ageing_stock', 'ml-IN', 'ഏറ്റവും പഴയ സ്റ്റോക്ക് ഏതാണ്'),
  ('ageing_stock', 'ml-IN', 'ഏതു കാറുകൾ പതുക്കെ വിൽക്കുന്നു'),
  ('compliance_alerts', 'en-IN', 'any compliance alerts'),
  ('compliance_alerts', 'en-IN', 'whose insurance has expired'),
  ('compliance_alerts', 'en-IN', 'show pending document issues'),
  ('compliance_alerts', 'en-IN', 'which vehicles have alerts'),
  ('compliance_alerts', 'hi-IN', 'कोई अनुपालन अलर्ट है क्या'),
  ('compliance_alerts', 'hi-IN', 'किसका बीमा समाप्त हो गया है'),
  ('compliance_alerts', 'hi-IN', 'लंबित दस्तावेज़ समस्याएँ दिखाओ'),
  ('compliance_alerts', 'hi-IN', 'किन वाहनों पर अलर्ट हैं'),
  ('compliance_alerts', 'ta-IN', 'ஏதேனும் இணக்க எச்சரிக்கைகள் உள்ளதா'),
  ('compliance_alerts', 'ta-IN', 'யாருடைய காப்பீடு காலாவதியாகிவிட்டது'),
  ('compliance_alerts', 'ta-IN', 'நிலுவையில் உள்ள ஆவணச் சிக்கல்களைக் காட்டு'),
  ('compliance_alerts', 'ta-IN', 'எந்த வாகனங்களுக்கு எச்சரிக்கை உள்ளது'),
  ('compliance_alerts', 'te-IN', 'ఏవైనా కంప్లయన్స్ హెచ్చరికలు ఉన్నాయా'),
  ('compliance_alerts', 'te-IN', 'ఎవరి బీమా గడువు ముగిసింది'),
  ('compliance_alerts', 'te-IN', 'పెండింగ్ డాక్యుమెంట్ సమస్యలు చూపించు'),
  ('compliance_alerts', 'te-IN', 'ఏ వాహనాలకు హెచ్చరికలు ఉన్నాయి'),
  ('compliance_alerts', 'kn-IN', 'ಯಾವುದೇ ಅನುಸರಣೆ ಎಚ್ಚರಿಕೆಗಳಿವೆಯೇ'),
  ('compliance_alerts', 'kn-IN', 'ಯಾರ ವಿಮೆ ಅವಧಿ ಮುಗಿದಿದೆ'),
  ('compliance_alerts', 'kn-IN', 'ಬಾಕಿ ಇರುವ ದಾಖಲೆ ಸಮಸ್ಯೆಗಳನ್ನು ತೋರಿಸಿ'),
  ('compliance_alerts', 'kn-IN', 'ಯಾವ ವಾಹನಗಳಿಗೆ ಎಚ್ಚರಿಕೆಗಳಿವೆ'),
  ('compliance_alerts', 'ml-IN', 'എന്തെങ്കിലും കംപ്ലയൻസ് അലർട്ടുകൾ ഉണ്ടോ'),
  ('compliance_alerts', 'ml-IN', 'ആരുടെ ഇൻഷുറൻസ് കാലാവധി കഴിഞ്ഞു'),
  ('compliance_alerts', 'ml-IN', 'തീർപ്പാക്കാത്ത രേഖാ പ്രശ്നങ്ങൾ കാണിക്കൂ'),
  ('compliance_alerts', 'ml-IN', 'ഏതു വാഹനങ്ങൾക്ക് അലർട്ടുകൾ ഉണ്ട്'),
  ('finance_overview', 'en-IN', 'explain this month''s profit performance'),
  ('finance_overview', 'en-IN', 'how are our expenses looking'),
  ('finance_overview', 'en-IN', 'what is our overall finance summary'),
  ('finance_overview', 'en-IN', 'how much did we spend last month'),
  ('finance_overview', 'hi-IN', 'इस महीने का मुनाफ़ा कैसा रहा'),
  ('finance_overview', 'hi-IN', 'हमारे खर्चे कैसे चल रहे हैं'),
  ('finance_overview', 'hi-IN', 'कुल वित्तीय सारांश क्या है'),
  ('finance_overview', 'hi-IN', 'पिछले महीने कितना खर्च हुआ'),
  ('finance_overview', 'ta-IN', 'இந்த மாத லாபம் எப்படி உள்ளது'),
  ('finance_overview', 'ta-IN', 'நமது செலவுகள் எப்படி உள்ளன'),
  ('finance_overview', 'ta-IN', 'ஒட்டுமொத்த நிதி சுருக்கம் என்ன'),
  ('finance_overview', 'ta-IN', 'கடந்த மாதம் எவ்வளவு செலவானது'),
  ('finance_overview', 'te-IN', 'ఈ నెల లాభం ఎలా ఉంది'),
  ('finance_overview', 'te-IN', 'మన ఖర్చులు ఎలా ఉన్నాయి'),
  ('finance_overview', 'te-IN', 'మొత్తం ఆర్థిక సారాంశం ఏమిటి'),
  ('finance_overview', 'te-IN', 'గత నెలలో ఎంత ఖర్చు అయింది'),
  ('finance_overview', 'kn-IN', 'ಈ ತಿಂಗಳ ಲಾಭ ಹೇಗಿದೆ'),
  ('finance_overview', 'kn-IN', 'ನಮ್ಮ ಖರ್ಚುಗಳು ಹೇಗಿವೆ'),
  ('finance_overview', 'kn-IN', 'ಒಟ್ಟಾರೆ ಹಣಕಾಸು ಸಾರಾಂಶ ಏನು'),
  ('finance_overview', 'kn-IN', 'ಕಳೆದ ತಿಂಗಳು ಎಷ್ಟು ಖರ್ಚಾಯಿತು'),
  ('finance_overview', 'ml-IN', 'ഈ മാസത്തെ ലാഭം എങ്ങനെയുണ്ട്'),
  ('finance_overview', 'ml-IN', 'നമ്മുടെ ചെലവുകൾ എങ്ങനെയുണ്ട്'),
  ('finance_overview', 'ml-IN', 'മൊത്തം സാമ്പത്തിക സംഗ്രഹം എന്താണ്'),
  ('finance_overview', 'ml-IN', 'കഴിഞ്ഞ മാസം എത്ര ചെലവായി')
on conflict (intent, locale, phrase) do nothing;
