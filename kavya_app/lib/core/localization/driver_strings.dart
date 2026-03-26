/// Driver UI localization strings.
/// Only user-facing instructional text is translated.
/// Constants (trip numbers, status codes, amounts) remain in English.
library;

enum AppLocale { en, ta, hi, kn, te, ml }

const localeLabels = {
  AppLocale.en: 'English',
  AppLocale.ta: 'தமிழ்',
  AppLocale.hi: 'हिन्दी',
  AppLocale.kn: 'ಕನ್ನಡ',
  AppLocale.te: 'తెలుగు',
  AppLocale.ml: 'മലയാളം',
};

class S {
  final AppLocale locale;
  const S(this.locale);

  String get _l => locale.name;
  String _t(Map<String, String> m) => m[_l] ?? m['en']!;

  // ── Shell / Home ──
  String greeting(String name) => _t({
    'en': 'Hi, $name',
    'ta': 'வணக்கம், $name',
    'hi': 'नमस्ते, $name',
    'kn': 'ನಮಸ್ಕಾರ, $name',
    'te': 'నమస్తే, $name',
    'ml': 'നമസ്കാരം, $name',
  });

  String get today => _t({'en':'Today','ta':'இன்று','hi':'आज','kn':'ಇಂದು','te':'ఈరోజు','ml':'ഇന്ന്'});
  String get trips => _t({'en':'Trips','ta':'பயணங்கள்','hi':'यात्राएँ','kn':'ಪ್ರವಾಸಗಳು','te':'ట్రిప్‌లు','ml':'ട്രിപ്പുകൾ'});
  String get expenses => _t({'en':'Expenses','ta':'செலவுகள்','hi':'खर्चे','kn':'ಖರ್ಚುಗಳು','te':'ఖర్చులు','ml':'ചെലവുകൾ'});
  String get profile => _t({'en':'Profile','ta':'சுயவிவரம்','hi':'प्रोफ़ाइल','kn':'ಪ್ರೊಫೈಲ್','te':'ప్రొఫైల్','ml':'പ്രൊഫൈൽ'});
  String get myProfile => _t({'en':'My Profile','ta':'என் சுயவிவரம்','hi':'मेरी प्रोफ़ाइल','kn':'ನನ್ನ ಪ್ರೊಫೈಲ್','te':'నా ప్రొఫైల్','ml':'എന്റെ പ്രൊഫൈൽ'});
  String get logout => _t({'en':'Logout','ta':'வெளியேறு','hi':'लॉगआउट','kn':'ಲಾಗ್ ಔಟ್','te':'లాగ్ అవుట్','ml':'ലോഗൗട്ട്'});
  String get languageSettings => _t({'en':'Language Settings','ta':'மொழி அமைப்புகள்','hi':'भाषा सेटिंग्स','kn':'ಭಾಷಾ ಸೆಟ್ಟಿಂಗ್ಸ್','te':'భాషా సెట్టింగ్‌లు','ml':'ഭാഷാ ക്രമീകരണം'});

  // ── Today / Dashboard ──
  String get attendance => _t({'en':'Attendance','ta':'வருகை','hi':'उपस्थिति','kn':'ಹಾಜರಾತಿ','te':'హాజరు','ml':'ഹാജർ'});
  String get checkInTime => _t({'en':'Check-in Time','ta':'வருகை நேரம்','hi':'चेक-इन समय','kn':'ಚೆಕ್-ಇನ್ ಸಮಯ','te':'చెక్-ఇన్ సమయం','ml':'ചെക്ക്-ഇൻ സമയം'});
  String get status => _t({'en':'Status','ta':'நிலை','hi':'स्थिति','kn':'ಸ್ಥಿತಿ','te':'స్థితి','ml':'സ്ഥിതി'});
  String get markAttendance => _t({'en':'Mark Attendance','ta':'வருகை பதிவு செய்','hi':'उपस्थिति दर्ज करें','kn':'ಹಾಜರಾತಿ ಗುರುತಿಸಿ','te':'హాజరు నమోదు చేయండి','ml':'ഹാജർ രേഖപ്പെടുത്തുക'});
  String get present => _t({'en':'Present','ta':'இருக்கிறார்','hi':'उपस्थित','kn':'ಹಾಜರ್','te':'హాజరు','ml':'ഹാജർ'});
  String get late_ => _t({'en':'Late','ta':'தாமதம்','hi':'देरी','kn':'ತಡ','te':'ఆలస్యం','ml':'വൈകി'});
  String get notCheckedIn => _t({'en':'Not Checked In','ta':'வருகை பதிவு இல்லை','hi':'चेक इन नहीं किया','kn':'ಚೆಕ್ ಇನ್ ಆಗಿಲ್ಲ','te':'చెక్ ఇన్ కాలేదు','ml':'ചെക്ക് ഇൻ ചെയ്തിട്ടില്ല'});
  String get noActiveTrip => _t({'en':'No active trip','ta':'செயலில் பயணம் இல்லை','hi':'कोई सक्रिय यात्रा नहीं','kn':'ಸಕ್ರಿಯ ಪ್ರವಾಸ ಇಲ್ಲ','te':'యాక్టివ్ ట్రిప్ లేదు','ml':'സജീവ ട്രിപ്പ് ഇല്ല'});
  String get startTripToSeeStatus => _t({'en':'Start a trip to see status','ta':'நிலை பார்க்க பயணத்தை தொடங்கவும்','hi':'स्थिति देखने के लिए यात्रा शुरू करें','kn':'ಸ್ಥಿತಿ ನೋಡಲು ಪ್ರವಾಸ ಪ್ರಾರಂಭಿಸಿ','te':'స్థితి చూడటానికి ట్రిప్ ప్రారంభించండి','ml':'സ്ഥിതി കാണാൻ ട്രിപ്പ് ആരംഭിക്കുക'});
  String get availableTrips => _t({'en':'Available Trips','ta':'கிடைக்கும் பயணங்கள்','hi':'उपलब्ध यात्राएँ','kn':'ಲಭ್ಯವಿರುವ ಪ್ರವಾಸಗಳು','te':'అందుబాటులో ఉన్న ట్రిప్‌లు','ml':'ലഭ്യമായ ട്രിപ്പുകൾ'});
  String get quickActions => _t({'en':'Quick Actions','ta':'விரைவு செயல்கள்','hi':'त्वरित कार्य','kn':'ತ್ವರಿತ ಕ್ರಿಯೆಗಳು','te':'త్వరిత చర్యలు','ml':'ദ്രുത പ്രവർത്തനങ്ങൾ'});
  String get addExpense => _t({'en':'Add Expense','ta':'செலவு சேர்','hi':'खर्च जोड़ें','kn':'ಖರ್ಚು ಸೇರಿಸಿ','te':'ఖర్చు జోడించు','ml':'ചെലവ് ചേർക്കുക'});
  String get checklist => _t({'en':'Checklist','ta':'சரிபார்ப்பு பட்டியல்','hi':'चेकलिस्ट','kn':'ಪರಿಶೀಲನಾ ಪಟ್ಟಿ','te':'చెక్‌లిస్ట్','ml':'ചെക്ക്‌ലിസ്റ്റ്'});
  String get documents => _t({'en':'Documents','ta':'ஆவணங்கள்','hi':'दस्तावेज़','kn':'ದಾಖಲೆಗಳು','te':'పత్రాలు','ml':'രേഖകൾ'});
  String get notifications => _t({'en':'Notifications','ta':'அறிவிப்புகள்','hi':'सूचनाएं','kn':'ಅಧಿಸೂಚನೆಗಳು','te':'నోటిఫికేషన్‌లు','ml':'അറിയിപ്പുകൾ'});
  String get myEarnings => _t({'en':'My Earnings','ta':'என் வருமானம்','hi':'मेरी कमाई','kn':'ನನ್ನ ಗಳಿಕೆ','te':'నా ఆదాయం','ml':'എന്റെ വരുമാനം'});
  String get vehicle => _t({'en':'Vehicle','ta':'வாகனம்','hi':'वाहन','kn':'ವಾಹನ','te':'వాహనం','ml':'വാഹനം'});
  String get noTripsAvailable => _t({'en':'No trips available','ta':'பயணங்கள் இல்லை','hi':'कोई यात्रा उपलब्ध नहीं','kn':'ಯಾವುದೇ ಪ್ರವಾಸ ಲಭ್ಯವಿಲ್ಲ','te':'ట్రిప్‌లు అందుబాటులో లేవు','ml':'ട്രിപ്പുകൾ ലഭ്യമല്ല'});
  String get acceptTrip => _t({'en':'Accept Trip','ta':'பயணத்தை ஏற்கவும்','hi':'यात्रा स्वीकार करें','kn':'ಪ್ರವಾಸ ಸ್ವೀಕರಿಸಿ','te':'ట్రిప్ అంగీకరించు','ml':'ട്രിപ്പ് സ്വീകരിക്കുക'});
  String get decline => _t({'en':'Decline','ta':'மறுக்கவும்','hi':'अस्वीकार','kn':'ನಿರಾಕರಿಸಿ','te':'తిరస్కరించు','ml':'നിരസിക്കുക'});
  String get declineTrip => _t({'en':'Decline Trip?','ta':'பயணத்தை மறுக்கவா?','hi':'यात्रा अस्वीकार करें?','kn':'ಪ್ರವಾಸ ನಿರಾಕರಿಸಿ?','te':'ట్రిప్ తిరస్కరించాలా?','ml':'ട്രിപ്പ് നിരസിക്കണോ?'});
  String declineTripConfirm(String num) => _t({
    'en': 'Are you sure you want to decline trip $num?',
    'ta': 'பயணம் $num-ஐ மறுக்க விரும்புகிறீர்களா?',
    'hi': 'क्या आप यात्रा $num को अस्वीकार करना चाहते हैं?',
    'kn': 'ನೀವು ಪ್ರವಾಸ $num ಅನ್ನು ನಿರಾಕರಿಸಲು ಬಯಸುವಿರಾ?',
    'te': 'మీరు ట్రిప్ $num తిరస్కరించాలనుకుంటున్నారా?',
    'ml': 'നിങ്ങൾ ട്രിപ്പ് $num നിരസിക്കണമെന്ന് ഉറപ്പാണോ?',
  });
  String get cancel => _t({'en':'Cancel','ta':'ரத்து செய்','hi':'रद्द करें','kn':'ರದ್ದುಮಾಡಿ','te':'రద్దు చేయి','ml':'റദ്ദാക്കുക'});
  String tripAccepted(String num) => _t({
    'en': 'Trip $num accepted!',
    'ta': 'பயணம் $num ஏற்கப்பட்டது!',
    'hi': 'यात्रा $num स्वीकार!',
    'kn': 'ಪ್ರವಾಸ $num ಸ್ವೀಕರಿಸಲಾಗಿದೆ!',
    'te': 'ట్రిప్ $num అంగీకరించబడింది!',
    'ml': 'ട്രിപ്പ് $num സ്വീകരിച്ചു!',
  });
  String tripDeclined(String num) => _t({
    'en': 'Trip $num declined',
    'ta': 'பயணம் $num மறுக்கப்பட்டது',
    'hi': 'यात्रा $num अस्वीकार',
    'kn': 'ಪ್ರವಾಸ $num ನಿರಾಕರಿಸಲಾಗಿದೆ',
    'te': 'ట్రిప్ $num తిరస్కరించబడింది',
    'ml': 'ട്രിപ്പ് $num നിരസിച്ചു',
  });
  String get newTripAssigned => _t({'en':'New Trip Assigned','ta':'புதிய பயணம் ஒதுக்கப்பட்டது','hi':'नई यात्रा सौंपी गई','kn':'ಹೊಸ ಪ್ರವಾಸ ನಿಯೋಜಿಸಲಾಗಿದೆ','te':'కొత్త ట్రిప్ కేటాయించబడింది','ml':'പുതിയ ട്രിപ്പ് നൽകിയിരിക്കുന്നു'});
  String get driverScore => _t({'en':'Driver Score','ta':'ஓட்டுநர் மதிப்பெண்','hi':'ड्राइवर स्कोर','kn':'ಚಾಲಕ ಅಂಕ','te':'డ్రైవర్ స్కోరు','ml':'ഡ്രൈവർ സ്‌കോർ'});
  String get sosAlertSent => _t({'en':'🆘 SOS Alert Sent!','ta':'🆘 SOS எச்சரிக்கை அனுப்பப்பட்டது!','hi':'🆘 SOS अलर्ट भेजा गया!','kn':'🆘 SOS ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲಾಗಿದೆ!','te':'🆘 SOS అలర్ట్ పంపబడింది!','ml':'🆘 SOS അലേർട്ട് അയച്ചു!'});
  String get sosNotifiedMessage => _t({'en':'Admin & Fleet Managers have been notified immediately.','ta':'நிர்வாகி & வாகனப்படை மேலாளர்கள் உடனடியாக அறிவிக்கப்பட்டனர்.','hi':'एडमिन और फ्लीट मैनेजर को तुरंत सूचित किया गया है।','kn':'ನಿರ್ವಾಹಕರು ಮತ್ತು ಫ್ಲೀಟ್ ಮ್ಯಾನೇಜರ್ ಗಳಿಗೆ ತಕ್ಷಣ ತಿಳಿಸಲಾಗಿದೆ.','te':'అడ్మిన్ & ఫ్లీట్ మేనేజర్లకు వెంటనే తెలియజేయబడింది.','ml':'അഡ്മിൻ & ഫ്ലീറ്റ് മാനേജർമാരെ ഉടൻ അറിയിച്ചു.'});
  String get sosFailed => _t({'en':'SOS Failed','ta':'SOS தோல்வி','hi':'SOS विफल','kn':'SOS ವಿಫಲ','te':'SOS విఫలం','ml':'SOS പരാജയം'});
  String get sosRequiresTrip => _t({'en':'No active trip. SOS requires an active trip.','ta':'செயலில் பயணம் இல்லை. SOSக்கு ஒரு செயலில் பயணம் தேவை.','hi':'कोई सक्रिय यात्रा नहीं। SOS के लिए सक्रिय यात्रा आवश्यक है।','kn':'ಸಕ್ರಿಯ ಪ್ರವಾಸ ಇಲ್ಲ. SOSಗೆ ಸಕ್ರಿಯ ಪ್ರವಾಸ ಅಗತ್ಯ.','te':'యాక్టివ్ ట్రిప్ లేదు. SOSకు యాక్టివ్ ట్రిప్ అవసరం.','ml':'സജീവ ട്രിപ്പ് ഇല്ല. SOSന് സജീവ ട്രിപ്പ് ആവശ്യമാണ്.'});
  String get holdForSos => _t({'en':'HOLD FOR SOS','ta':'SOS க்கு அழுத்தவும்','hi':'SOS के लिए दबाएं','kn':'SOS ಗಾಗಿ ಒತ್ತಿ ಹಿಡಿಯಿರಿ','te':'SOS కోసం నొక్కి పట్టుకోండి','ml':'SOS-ന് അമർത്തി പിടിക്കുക'});

  // ── Trip List ──
  String get searchTrips => _t({'en':'Search trips...','ta':'பயணங்களை தேடு...','hi':'यात्रा खोजें...','kn':'ಪ್ರವಾಸ ಹುಡುಕಿ...','te':'ట్రిప్‌లు వెతుకు...','ml':'ട്രിപ്പുകൾ തിരയുക...'});
  String get all => _t({'en':'All','ta':'அனைத்தும்','hi':'सभी','kn':'ಎಲ್ಲಾ','te':'అన్నీ','ml':'എല്ലാം'});
  String get pending => _t({'en':'Pending','ta':'நிலுவையில்','hi':'लंबित','kn':'ಬಾಕಿ','te':'పెండింగ్','ml':'തീർപ്പാക്കാത്ത'});
  String get inTransit => _t({'en':'In Transit','ta':'போக்குவரத்தில்','hi':'पारगमन में','kn':'ಸಾಗಣೆಯಲ್ಲಿ','te':'రవాణాలో','ml':'ഗതാഗതത്തിൽ'});
  String get completed => _t({'en':'Completed','ta':'முடிந்தது','hi':'पूर्ण','kn':'ಪೂರ್ಣ','te':'పూర్తయింది','ml':'പൂർത്തിയായി'});
  String get noTripsFound => _t({'en':'No trips found','ta':'பயணங்கள் கிடைக்கவில்லை','hi':'कोई यात्रा नहीं मिली','kn':'ಯಾವುದೇ ಪ್ರವಾಸ ಕಂಡುಬಂದಿಲ್ಲ','te':'ట్రిప్‌లు కనుగొనబడలేదు','ml':'ട്രിപ്പുകൾ കണ്ടെത്തിയില്ല'});
  String get tryAdjustingFilters => _t({'en':'Try adjusting filters','ta':'வடிகட்டிகளை மாற்றி முயற்சிக்கவும்','hi':'फ़िल्टर बदलकर देखें','kn':'ಫಿಲ್ಟರ್ ಬದಲಿಸಿ ಪ್ರಯತ್ನಿಸಿ','te':'ఫిల్టర్లు మార్చి ప్రయత్నించండి','ml':'ഫിൽട്ടറുകൾ മാറ്റി ശ്രമിക്കുക'});
  String get errorLoadingTrips => _t({'en':'Error loading trips','ta':'பயணங்களை ஏற்றுவதில் பிழை','hi':'यात्राएँ लोड करने में त्रुटि','kn':'ಪ್ರವಾಸ ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ','te':'ట్రిప్‌లు లోడ్ చేయడంలో లోపం','ml':'ട്രിപ്പുകൾ ലോഡ് ചെയ്യുന്നതിൽ പിശക്'});
  String get retry => _t({'en':'Retry','ta':'மீண்டும் முயற்சி','hi':'पुनः प्रयास','kn':'ಮರುಪ್ರಯತ್ನ','te':'మళ్ళీ ప్రయత్నించు','ml':'വീണ്ടും ശ്രമിക്കുക'});

  // ── Expenses ──
  String get searchExpenses => _t({'en':'Search expenses...','ta':'செலவுகளை தேடு...','hi':'खर्च खोजें...','kn':'ಖರ್ಚು ಹುಡುಕಿ...','te':'ఖర్చులు వెతుకు...','ml':'ചെലവുകൾ തിരയുക...'});
  String get approved => _t({'en':'Approved','ta':'அங்கீகரிக்கப்பட்டது','hi':'अनुमोदित','kn':'ಅನುಮೋದಿಸಲಾಗಿದೆ','te':'ఆమోదించబడింది','ml':'അംഗീകരിച്ചു'});
  String get paid => _t({'en':'Paid','ta':'செலுத்தப்பட்டது','hi':'भुगतान किया','kn':'ಪಾವತಿಸಲಾಗಿದೆ','te':'చెల్లించబడింది','ml':'പണം നൽകി'});
  String get rejected => _t({'en':'Rejected','ta':'நிராகரிக்கப்பட்டது','hi':'अस्वीकृत','kn':'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ','te':'తిరస్కరించబడింది','ml':'നിരസിച്ചു'});
  String get fuel => _t({'en':'Fuel','ta':'எரிபொருள்','hi':'ईंधन','kn':'ಇಂಧನ','te':'ఇంధనం','ml':'ഇന്ധനം'});
  String get toll => _t({'en':'Toll','ta':'சுங்கம்','hi':'टोल','kn':'ಟೋಲ್','te':'టోల్','ml':'ടോൾ'});
  String get food => _t({'en':'Food','ta':'உணவு','hi':'भोजन','kn':'ಆಹಾರ','te':'ఆహారం','ml':'ഭക്ഷണം'});
  String get maintenance => _t({'en':'Maintenance','ta':'பராமரிப்பு','hi':'रखरखाव','kn':'ನಿರ್ವಹಣೆ','te':'నిర్వహణ','ml':'അറ്റകുറ്റപ്പണി'});
  String get loading => _t({'en':'Loading','ta':'ஏற்றுதல்','hi':'लोडिंग','kn':'ಲೋಡಿಂಗ್','te':'లోడింగ్','ml':'ലോഡിംഗ്'});
  String get unloading => _t({'en':'Unloading','ta':'இறக்குதல்','hi':'अनलोडिंग','kn':'ಅನ್ ಲೋಡಿಂಗ್','te':'అన్‌లోడింగ్','ml':'അൺലോഡിംഗ്'});
  String get parking => _t({'en':'Parking','ta':'வாகன நிறுத்தம்','hi':'पार्किंग','kn':'ಪಾರ್ಕಿಂಗ್','te':'పార్కింగ్','ml':'പാർക്കിംഗ്'});
  String get police => _t({'en':'Police','ta':'காவல்','hi':'पुलिस','kn':'ಪೊಲೀಸ್','te':'పోలీస్','ml':'പോലീസ്'});
  String get other => _t({'en':'Other','ta':'மற்றவை','hi':'अन्य','kn':'ಇತರೆ','te':'ఇతర','ml':'മറ്റുള്ളവ'});
  String get noExpensesFound => _t({'en':'No expenses found','ta':'செலவுகள் இல்லை','hi':'कोई खर्च नहीं मिला','kn':'ಯಾವುದೇ ಖರ್ಚು ಕಂಡುಬಂದಿಲ್ಲ','te':'ఖర్చులు కనుగొనబడలేదు','ml':'ചെലവുകൾ കണ്ടെത്തിയില്ല'});
  String get tapPlusToAddExpense => _t({'en':'Tap + to add your first expense','ta':'முதல் செலவை சேர்க்க + தட்டவும்','hi':'पहला खर्च जोड़ने के लिए + दबाएं','kn':'ಮೊದಲ ಖರ್ಚು ಸೇರಿಸಲು + ಒತ್ತಿ','te':'మొదటి ఖర్చు జోడించడానికి + నొక్కండి','ml':'ആദ്യ ചെലവ് ചേർക്കാൻ + ടാപ്പ് ചെയ്യുക'});
  String get errorLoadingExpenses => _t({'en':'Error loading expenses','ta':'செலவுகளை ஏற்றுவதில் பிழை','hi':'खर्च लोड करने में त्रुटि','kn':'ಖರ್ಚು ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ','te':'ఖర్చులు లోడ్ చేయడంలో లోపం','ml':'ചെലവുകൾ ലോഡ് ചെയ്യുന്നതിൽ പിശക്'});

  // ── Profile ──
  String get personalInfo => _t({'en':'PERSONAL INFO','ta':'தனிப்பட்ட தகவல்','hi':'व्यक्तिगत जानकारी','kn':'ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ','te':'వ్యక్తిగత సమాచారం','ml':'വ്യക്തിഗത വിവരങ്ങൾ'});
  String get fullName => _t({'en':'Full Name','ta':'முழு பெயர்','hi':'पूरा नाम','kn':'ಪೂರ್ಣ ಹೆಸರು','te':'పూర్తి పేరు','ml':'മുഴുവൻ പേര്'});
  String get email => _t({'en':'Email','ta':'மின்னஞ்சல்','hi':'ईमेल','kn':'ಇಮೇಲ್','te':'ఇమెయిల్','ml':'ഇമെയിൽ'});
  String get phone => _t({'en':'Phone','ta':'தொலைபேசி','hi':'फ़ोन','kn':'ಫೋನ್','te':'ఫోన్','ml':'ഫോൺ'});
  String get statusLabel => _t({'en':'Status','ta':'நிலை','hi':'स्थिति','kn':'ಸ್ಥಿತಿ','te':'స్థితి','ml':'സ്ഥിതി'});
  String get active => _t({'en':'Active','ta':'செயலில்','hi':'सक्रिय','kn':'ಸಕ್ರಿಯ','te':'యాక్టివ్','ml':'സജീവം'});
  String get inactive => _t({'en':'Inactive','ta':'செயலற்றது','hi':'निष्क्रिय','kn':'ನಿಷ್ಕ್ರಿಯ','te':'నిష్క్రియం','ml':'നിഷ്ക്രിയം'});
  String get app => _t({'en':'APP','ta':'ஆப்','hi':'ऐप','kn':'ಆ್ಯಪ್','te':'యాప్','ml':'ആപ്പ്'});
  String get helpAndSupport => _t({'en':'Help & Support','ta':'உதவி & ஆதரவு','hi':'सहायता और सपोर्ट','kn':'ಸಹಾಯ ಮತ್ತು ಬೆಂಬಲ','te':'సహాయం & సపోర్ట్','ml':'സഹായവും പിന്തുണയും'});
  String get contactUsForAssistance => _t({'en':'Contact us for assistance','ta':'உதவிக்கு எங்களை தொடர்பு கொள்ளவும்','hi':'सहायता के लिए हमसे संपर्क करें','kn':'ಸಹಾಯಕ್ಕಾಗಿ ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ','te':'సహాయం కోసం మమ్మల్ని సంప్రదించండి','ml':'സഹായത്തിനായി ഞങ്ങളെ ബന്ധപ്പെടുക'});
  String get about => _t({'en':'About','ta':'பற்றி','hi':'जानकारी','kn':'ಬಗ್ಗೆ','te':'గురించి','ml':'കുറിച്ച്'});
  String get appInfoAndLicenses => _t({'en':'App info & open-source licenses','ta':'ஆப் தகவல் & திறந்த மூல உரிமங்கள்','hi':'ऐप जानकारी और ओपन-सोर्स लाइसेंस','kn':'ಆ್ಯಪ್ ಮಾಹಿತಿ ಮತ್ತು ತೆರೆಮೂಲ ಪರವಾನತಿಗಳು','te':'యాప్ సమాచారం & ఓపెన్-సోర్స్ లైసెన్సులు','ml':'ആപ്പ് വിവരങ്ങൾ & ഓപ്പൺ-സോഴ്‌സ് ലൈസൻസുകൾ'});
  String get logoutConfirm => _t({'en':'Are you sure you want to logout?','ta':'வெளியேற விரும்புகிறீர்களா?','hi':'क्या आप लॉगआउट करना चाहते हैं?','kn':'ನೀವು ಲಾಗ್ ಔಟ್ ಮಾಡಲು ಬಯಸುವಿರಾ?','te':'మీరు లాగ్ అవుట్ చేయాలనుకుంటున్నారా?','ml':'നിങ്ങൾ ലോഗൗട്ട് ചെയ്യണമെന്ന് ഉറപ്പാണോ?'});
  String get close => _t({'en':'Close','ta':'மூடு','hi':'बंद करें','kn':'ಮುಚ್ಚಿ','te':'మూసివేయి','ml':'അടയ്ക്കുക'});

  // ── Trip Details ──
  String get tripDetails => _t({'en':'Trip Details','ta':'பயண விவரங்கள்','hi':'यात्रा विवरण','kn':'ಪ್ರವಾಸ ವಿವರಗಳು','te':'ట్రిప్ వివరాలు','ml':'ട്രിപ്പ് വിശദാംശങ്ങൾ'});
  String get errorLoadingTrip => _t({'en':'Error loading trip','ta':'பயணத்தை ஏற்றுவதில் பிழை','hi':'यात्रा लोड करने में त्रुटि','kn':'ಪ್ರವಾಸ ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ','te':'ట్రిప్ లోడ్ చేయడంలో లోపం','ml':'ട്രിപ്പ് ലോഡ് ചെയ്യുന്നതിൽ പിശക്'});
  String get goBack => _t({'en':'Go Back','ta':'திரும்பி செல்','hi':'वापस जाएं','kn':'ಹಿಂದೆ ಹೋಗಿ','te':'వెనక్కి వెళ్ళు','ml':'തിരികെ പോകുക'});
  String get route => _t({'en':'Route','ta':'பாதை','hi':'मार्ग','kn':'ಮಾರ್ಗ','te':'మార్గం','ml':'വഴി'});
  String get origin => _t({'en':'Origin','ta':'புறப்படும் இடம்','hi':'प्रस्थान','kn':'ಮೂಲ','te':'ప్రారంభ స్థానం','ml':'ആരംഭ സ്ഥലം'});
  String get destination => _t({'en':'Destination','ta':'சேரும் இடம்','hi':'गंतव्य','kn':'ಗಮ್ಯಸ್ಥಾನ','te':'గమ్యస్థానం','ml':'ലക്ഷ്യസ്ഥാനം'});
  String get liveTracking => _t({'en':'Live Tracking','ta':'நேரடி கண்காணிப்பு','hi':'लाइव ट्रैकिंग','kn':'ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್','te':'లైవ్ ట్రాకింగ్','ml':'ലൈവ് ട്രാക്കിംഗ്'});
  String get routeMap => _t({'en':'Route Map','ta':'பாதை வரைபடம்','hi':'मार्ग मानचित्र','kn':'ಮಾರ್ಗ ನಕ್ಷೆ','te':'మార్గ మ్యాప్','ml':'വഴി മാപ്പ്'});
  String get details => _t({'en':'Details','ta':'விவரங்கள்','hi':'विवरण','kn':'ವಿವರಗಳು','te':'వివరాలు','ml':'വിശദാംശങ്ങൾ'});
  String get remarks => _t({'en':'Remarks','ta':'குறிப்புகள்','hi':'टिप्पणियाँ','kn':'ಟಿಪ್ಪಣಿಗಳು','te':'వ్యాఖ్యలు','ml':'കുറിപ്പുകൾ'});
  String get actions => _t({'en':'Actions','ta':'செயல்கள்','hi':'कार्रवाई','kn':'ಕ್ರಿಯೆಗಳು','te':'చర్యలు','ml':'പ്രവർത്തനങ്ങൾ'});
  String get updateStatus => _t({'en':'Update Status','ta':'நிலையை புதுப்பி','hi':'स्थिति अपडेट करें','kn':'ಸ್ಥಿತಿ ನವೀಕರಿಸಿ','te':'స్థితి అప్‌డేట్ చేయండి','ml':'സ്ഥിതി അപ്ഡേറ്റ് ചെയ്യുക'});
  String get completeDeliveryEpod => _t({'en':'Complete Delivery (ePOD)','ta':'டெலிவரி முடி (ePOD)','hi':'डिलीवरी पूर्ण करें (ePOD)','kn':'ವಿತರಣೆ ಪೂರ್ಣಗೊಳಿಸಿ (ePOD)','te':'డెలివరీ పూర్తి చేయండి (ePOD)','ml':'ഡെലിവറി പൂർത്തിയാക്കുക (ePOD)'});

  // ── Add Expense ──
  String get addExpenseTitle => _t({'en':'Add Expense','ta':'செலவு சேர்','hi':'खर्च जोड़ें','kn':'ಖರ್ಚು ಸೇರಿಸಿ','te':'ఖర్చు జోడించు','ml':'ചെലവ് ചേർക്കുക'});
  String get category => _t({'en':'Category','ta':'வகை','hi':'श्रेणी','kn':'ವರ್ಗ','te':'వర్గం','ml':'വിഭാഗം'});
  String get amount => _t({'en':'Amount (₹)','ta':'தொகை (₹)','hi':'राशि (₹)','kn':'ಮೊತ್ತ (₹)','te':'మొత్తం (₹)','ml':'തുക (₹)'});
  String get required_ => _t({'en':'Required','ta':'தேவை','hi':'आवश्यक','kn':'ಅಗತ್ಯ','te':'అవసరం','ml':'ആവശ്യമാണ്'});
  String get invalidAmount => _t({'en':'Invalid amount','ta':'தவறான தொகை','hi':'अमान्य राशि','kn':'ಅಮಾನ್ಯ ಮೊತ್ತ','te':'చెల్లని మొత్తం','ml':'അസാധുവായ തുക'});
  String get description => _t({'en':'Description','ta':'விளக்கம்','hi':'विवरण','kn':'ವಿವರಣೆ','te':'వివరణ','ml':'വിവരണം'});
  String get optionalNotes => _t({'en':'Optional notes','ta':'விருப்ப குறிப்புகள்','hi':'वैकल्पिक नोट्स','kn':'ಐಚ್ಛಿಕ ಟಿಪ್ಪಣಿಗಳು','te':'ఐచ్ఛిక గమనికలు','ml':'ഐച്ഛിക കുറിപ്പുകൾ'});
  String get receiptPhoto => _t({'en':'Receipt Photo','ta':'ரசீது புகைப்படம்','hi':'रसीद फोटो','kn':'ರಶೀದಿ ಫೋಟೋ','te':'రసీదు ఫోటో','ml':'രസീത് ഫോട്ടോ'});
  String get verifyingReceipt => _t({'en':'Verifying receipt...','ta':'ரசீது சரிபார்க்கப்படுகிறது...','hi':'रसीद सत्यापित हो रही है...','kn':'ರಶೀದಿ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...','te':'రసీదు ధృవీకరించబడుతోంది...','ml':'രസീത് പരിശോധിക്കുന്നു...'});
  String get saveExpense => _t({'en':'Save Expense','ta':'செலவு சேமி','hi':'खर्च सेव करें','kn':'ಖರ್ಚು ಉಳಿಸಿ','te':'ఖర్చు సేవ్ చేయి','ml':'ചെലവ് സേവ് ചെയ്യുക'});
  String get expenseAdded => _t({'en':'Expense added','ta':'செலவு சேர்க்கப்பட்டது','hi':'खर्च जोड़ा गया','kn':'ಖರ್ಚು ಸೇರಿಸಲಾಗಿದೆ','te':'ఖర్చు జోడించబడింది','ml':'ചെലവ് ചേർത്തു'});
  String get amountMismatch => _t({'en':'Amount Mismatch','ta':'தொகை பொருந்தவில்லை','hi':'राशि मेल नहीं खाती','kn':'ಮೊತ್ತ ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ','te':'మొత్తం సరిపోలడం లేదు','ml':'തുക പൊരുത്തപ്പെടുന്നില്ല'});
  String get correctAmount => _t({'en':'CORRECT AMOUNT','ta':'தொகையை சரி செய்','hi':'राशि सही करें','kn':'ಮೊತ್ತ ಸರಿಪಡಿಸಿ','te':'మొత్తం సరి చేయండి','ml':'തുക ശരിയാക്കുക'});
  String get proceedAnyway => _t({'en':'PROCEED ANYWAY','ta':'எப்படியும் தொடர்','hi':'फिर भी आगे बढ़ें','kn':'ಹೇಗಾದರೂ ಮುಂದುವರಿಸಿ','te':'ఏమైనా కొనసాగించు','ml':'എങ്കിലും തുടരുക'});

  // ── Notifications ──
  String get markAllRead => _t({'en':'Mark all read','ta':'அனைத்தையும் படித்ததாக குறி','hi':'सभी पढ़ा हुआ करें','kn':'ಎಲ್ಲವನ್ನೂ ಓದಿದ ಎಂದು ಗುರುತಿಸಿ','te':'అన్నీ చదివినట్లు గుర్తించు','ml':'എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക'});
  String get allCaughtUp => _t({'en':'All caught up!','ta':'அனைத்தும் பார்த்தாச்சு!','hi':'सब देख लिया!','kn':'ಎಲ್ಲವೂ ನೋಡಾಯಿತು!','te':'అన్నీ చూసేశారు!','ml':'എല്ലാം കണ്ടു!'});
  String get tripUpdatesWillAppear => _t({'en':'Trip updates will appear here.','ta':'பயண புதுப்பிப்புகள் இங்கே தோன்றும்.','hi':'यात्रा अपडेट यहाँ दिखेंगे।','kn':'ಪ್ರವಾಸ ನವೀಕರಣಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.','te':'ట్రిప్ అప్‌డేట్లు ఇక్కడ కనిపిస్తాయి.','ml':'ട്രിപ്പ് അപ്ഡേറ്റുകൾ ഇവിടെ ദൃശ്യമാകും.'});

  // ── Vehicle ──
  String get myVehicle => _t({'en':'My Vehicle','ta':'என் வாகனம்','hi':'मेरा वाहन','kn':'ನನ್ನ ವಾಹನ','te':'నా వాహనం','ml':'എന്റെ വാഹനം'});
  String get vehicleDocuments => _t({'en':'Vehicle Documents','ta':'வாகன ஆவணங்கள்','hi':'वाहन दस्तावेज़','kn':'ವಾಹನ ದಾಖಲೆಗಳು','te':'వాహన పత్రాలు','ml':'വാഹന രേഖകൾ'});

  // ── Documents ──
  String get driverDocuments => _t({'en':'Driver Documents','ta':'ஓட்டுநர் ஆவணங்கள்','hi':'ड्राइवर दस्तावेज़','kn':'ಚಾಲಕ ದಾಖಲೆಗಳು','te':'డ్రైవర్ పత్రాలు','ml':'ഡ്രൈവർ രേഖകൾ'});

  // ── Settlement / Earnings ──
  String get settlementHistory => _t({'en':'Settlement History','ta':'தீர்வு வரலாறு','hi':'निपटान इतिहास','kn':'ಪರಿಹಾರ ಇತಿಹಾಸ','te':'సెటిల్‌మెంట్ చరిత్ర','ml':'സെറ്റിൽമെന്റ് ചരിത്രം'});

  // ── Checklist ──
  String get checklistType => _t({'en':'Checklist Type','ta':'சரிபார்ப்பு வகை','hi':'चेकलिस्ट प्रकार','kn':'ಪರಿಶೀಲನಾ ಪ್ರಕಾರ','te':'చెక్‌లిస్ట్ రకం','ml':'ചെക്ക്‌ലിസ്റ്റ് തരം'});
  String get progress => _t({'en':'Progress','ta':'முன்னேற்றம்','hi':'प्रगति','kn':'ಪ್ರಗತಿ','te':'పురోగతి','ml':'പുരോഗതി'});
  String get items => _t({'en':'Items','ta':'உருப்படிகள்','hi':'आइटम','kn':'ಐಟಂಗಳು','te':'అంశాలు','ml':'ഇനങ്ങൾ'});
  String get notesOptional => _t({'en':'Notes (Optional)','ta':'குறிப்புகள் (விருப்பம்)','hi':'नोट्स (वैकल्पिक)','kn':'ಟಿಪ್ಪಣಿಗಳು (ಐಚ್ಛಿಕ)','te':'గమనికలు (ఐచ్ఛికం)','ml':'കുറിപ്പുകൾ (ഐച്ഛികം)'});
  String get completeChecklist => _t({'en':'Complete Checklist','ta':'சரிபார்ப்பை முடி','hi':'चेकलिस्ट पूरी करें','kn':'ಪರಿಶೀಲನಾ ಪಟ್ಟಿ ಪೂರ್ಣಗೊಳಿಸಿ','te':'చెక్‌లిస్ట్ పూర్తి చేయండి','ml':'ചെക്ക്‌ലിസ്റ്റ് പൂർത്തിയാക്കുക'});
  String get completeAllItems => _t({'en':'Complete All Items to Submit','ta':'சமர்ப்பிக்க அனைத்தையும் முடிக்கவும்','hi':'सबमिट करने के लिए सभी पूरा करें','kn':'ಸಲ್ಲಿಸಲು ಎಲ್ಲಾ ಐಟಂಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ','te':'సమर్పించడానికి అన్ని అంశాలు పూర్తి చేయండి','ml':'സമർപ്പിക്കാൻ എല്ലാ ഇനങ്ങളും പൂർത്തിയാക്കുക'});

  // ── ePOD ──
  String get eDeliveryProof => _t({'en':'e-Proof of Delivery','ta':'இ-டெலிவரி ஆதாரம்','hi':'ई-डिलीवरी प्रमाण','kn':'ಇ-ವಿತರಣೆ ಪುರಾವೆ','te':'ఇ-డెలివరీ ప్రూఫ్','ml':'ഇ-ഡെലിവറി തെളിവ്'});

  // ── GPS ──
  String get liveGpsTracking => _t({'en':'Live GPS Tracking','ta':'நேரடி GPS கண்காணிப்பு','hi':'लाइव GPS ट्रैकिंग','kn':'ಲೈವ್ GPS ಟ್ರ್ಯಾಕಿಂಗ್','te':'లైవ్ GPS ట్రాకింగ్','ml':'ലൈവ് GPS ട്രാക്കിംഗ്'});

  // ── Language Settings Screen ──
  String get selectLanguage => _t({'en':'Select Language','ta':'மொழியைத் தேர்வு செய்','hi':'भाषा चुनें','kn':'ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ','te':'భాషను ఎంచుకోండి','ml':'ഭാഷ തിരഞ്ഞെടുക്കുക'});
  String get languageChanged => _t({'en':'Language changed','ta':'மொழி மாற்றப்பட்டது','hi':'भाषा बदली गई','kn':'ಭಾಷೆ ಬದಲಾಯಿಸಲಾಗಿದೆ','te':'భాష మార్చబడింది','ml':'ഭാഷ മാറ്റി'});
  String get choosePreferredLanguage => _t({'en':'Choose your preferred language','ta':'உங்களுக்கு விருப்பமான மொழியைத் தேர்வு செய்யவும்','hi':'अपनी पसंदीदा भाषा चुनें','kn':'ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ','te':'మీకు నచ్చిన భాషను ఎంచుకోండి','ml':'നിങ്ങൾ ഇഷ്ടപ്പെടുന്ന ഭാഷ തിരഞ്ഞെടുക്കുക'});
}
