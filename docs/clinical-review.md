# Clinical review manifest

Every clinically meaningful string in the product, in all three languages, for a
clinician to confirm before release.

**106 terms — 106 pending, 0 approved.**

## How to read this

The `medical` namespace exists so that everything a donor could act on
medically — what they are donating, whether they may donate, what a laboratory
value means — sits in one place instead of being spread across nine screens.
This file is that namespace, rendered. It is generated from the catalogues by
`pnpm clinical:review`, so a term added to `medical` appears here whether or
not anyone remembers to add it.

The Uzbek and Russian wording is **deliberately literal**. It was written to be
confirmed or replaced by a clinician, not improved by a translator — a
plausible-sounding translation of a laboratory flag is more dangerous than an
awkward one, because nobody re-reads it.

## How to review

Two columns exist so a reviewer can judge a term rather than merely read it.
**Where it appears** is derived by scanning the apps for the key, so it is what
the code actually does, not what anyone remembers. **Why it matters** says what
a donor or a member of staff would do differently if the wording were wrong —
which is the question that decides whether a term needs a clinician at all.

1. Read **Why it matters** first. It tells you what kind of mistake you are
   looking for.
2. Read the English source. If the English itself is wrong or misleading, say so
   in Notes — that is the more important finding, and no translation can fix it.
3. Check the Uzbek and Russian say the same clinical thing, not merely a
   similar-sounding thing. The wording is deliberately literal; replace it
   freely.
4. Open the screen named in **Where it appears** if the surrounding context
   changes the meaning. A word that is right in a list can be wrong as a badge.
5. Set Status to `APPROVED` or `CHANGE REQUESTED`, and put the replacement
   wording in Notes.

A term marked *Not currently rendered* is in the catalogue but no screen uses
it today. It still needs review before a screen starts to.

Re-running `pnpm clinical:review` preserves Status and Notes, so sign-off is
never lost when a new term is added — including across this change, which added
the two context columns.

### Priority

If the review has to be done in stages, these namespaces carry the most risk
and should be signed first:

1. `medical.eligibility` and `medical.donorStatus` — whether a donor may donate.
2. `medical.resultFlags` and `medical.resultFlagsByCode` — how a donor reads a
   result about their own blood.
3. `medical.components` and `medical.donationTypes` — what is collected, and
   what is issued to a patient.
4. `medical.aiSafety` — how far a machine-generated explanation may be trusted.

Everything else is informational and can follow.

Nothing here should be edited in the catalogue without a reviewer's decision
recorded in this file.

## Terms

| Translation key | English source | Uzbek (Latin) | Russian | Where it appears | Why it matters | Status | Reviewer notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `medical.advice.askYourProvider` | Questions for your healthcare provider | Shifokoringizga beriladigan savollar | Вопросы для вашего врача | Donor app › app/insights | Given to a donor as guidance about their own health. | PENDING |  |
| `medical.advice.discussResults` | Discuss your results with a healthcare professional. | Natijalaringizni shifokor bilan muhokama qiling. | Обсудите результаты с врачом. | Not currently rendered | Given to a donor as guidance about their own health. | PENDING |  |
| `medical.advice.notMedicalAdvice` | This is general information, not medical advice. | Bu umumiy ma’lumot, tibbiy maslahat emas. | Это общая информация, а не медицинская консультация. | Not currently rendered | Given to a donor as guidance about their own health. | PENDING |  |
| `medical.aiInsightTypes.APPOINTMENT_INSIGHT` | Appointment insight | Uchrashuv haqida | О записи | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.DATA_CHANGE` | Change in your data | Ma’lumotlaringizdagi o‘zgarish | Изменение в данных | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.DATA_QUALITY_WARNING` | Data quality warning | Ma’lumot sifati haqida ogohlantirish | Предупреждение о качестве данных | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.DONATION_INSIGHT` | Donation insight | Qon topshirish haqida | О донациях | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.GENERAL_HEALTH_INFORMATION` | General health information | Umumiy sog‘liq ma’lumoti | Общая информация о здоровье | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.HEALTH_SUMMARY` | Health summary | Salomatlik xulosasi | Сводка о здоровье | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.QUESTION_SUGGESTION` | Questions to ask | Beriladigan savollar | Вопросы, которые стоит задать | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.REFERENCE_RANGE_CONTEXT` | Reference range context | Me’yoriy oraliq izohi | Пояснение к референсному диапазону | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.RESULT_EXPLANATION` | Result explanation | Natija izohi | Пояснение результата | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.TREND_SUMMARY` | Trend summary | Dinamika xulosasi | Сводка динамики | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiInsightTypes.WEEKLY_SUMMARY` | Weekly summary | Haftalik xulosa | Недельная сводка | Admin console › ai-analytics/page; Donor app › app/insights | Labels an AI-generated explanation by kind. | PENDING |  |
| `medical.aiSafety.EMERGENCY_REDIRECT` | Seek medical help now | Zudlik bilan tibbiy yordamga murojaat qiling | Немедленно обратитесь за медицинской помощью | Donor app › app/insights | How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice. | PENDING |  |
| `medical.aiSafety.NEEDS_CONTEXT` | Needs more context | Qo‘shimcha ma’lumot kerak | Нужен дополнительный контекст | Donor app › app/insights | How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice. | PENDING |  |
| `medical.aiSafety.OUT_OF_SCOPE` | Outside what this can answer | Bu savolga javob bera olmaydi | Вне рамок того, на что можно ответить | Donor app › app/insights | How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice. | PENDING |  |
| `medical.aiSafety.PROFESSIONAL_REVIEW_SUGGESTED` | Discuss with a healthcare professional | Shifokor bilan maslahatlashing | Обсудите с врачом | Donor app › app/insights | How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice. | PENDING |  |
| `medical.aiSafety.SAFE_INFORMATIONAL` | Informational | Ma’lumot uchun | Информационно | Donor app › app/insights | How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice. | PENDING |  |
| `medical.aiSafety.disclaimer` | AI-generated informational content, drawn from your own recorded health data. It is not a medical diagnosis — always consult your doctor. | Bu — sizning qayd etilgan sog‘liq ma’lumotlaringiz asosida AI yaratgan ma’lumot. Bu tibbiy tashxis emas — har doim shifokoringiz bilan maslahatlashing. | Это информационный текст, сгенерированный ИИ на основе ваших записанных данных о здоровье. Это не медицинский диагноз — всегда консультируйтесь с врачом. | Donor app › app/insights | How far an AI-generated explanation may be trusted. Wrong here is a donor acting on a machine’s guess as if it were advice. | PENDING |  |
| `medical.appointmentTypes.bloodDonation` | Donation | Qon topshirish | Донация | Donor app › app/calendar | Names what the donor booked, on the reminder they act on. | PENDING |  |
| `medical.appointmentTypes.bloodTest` | Blood test | Qon tahlili | Анализ крови | Blood centre console › appointments/page; Donor app › app/calendar; Hospital console › appointments/page | Names what the donor booked, on the reminder they act on. | PENDING |  |
| `medical.appointmentTypes.consultation` | Consultation | Konsultatsiya | Консультация | Blood centre console › appointments/page; Donor app › app/calendar; Hospital console › appointments/page | Names what the donor booked, on the reminder they act on. | PENDING |  |
| `medical.assessment.APPROVED_FOR_DONATION` | Cleared to donate | Qon topshirishga ruxsat berildi | Допущен к донации | Blood centre console › donations/page; Hospital console › donations/page | The pre-donation decision staff record about a donor. | PENDING |  |
| `medical.assessment.DEFERRED` | Deferred | Vaqtincha chetlatilgan | Отвод | Blood centre console › donations/page; Hospital console › donations/page | The pre-donation decision staff record about a donor. | PENDING |  |
| `medical.assessment.NOT_COMPLETED` | Not completed | Yakunlanmagan | Не завершено | Not currently rendered | The pre-donation decision staff record about a donor. | PENDING |  |
| `medical.bloodGroup` | Blood group | Qon guruhi | Группа крови | Donor app › app/donations/[id]; Donor app › app/profile/donor; Donor app › onboarding/complete-profile | Shown to a donor or to staff in a clinical context. | PENDING |  |
| `medical.components.OTHER` | Other | Boshqa | Другое | Admin console › inventory/page; Admin console › moderation/page; Blood centre console › inventory/page; Blood centre console › requests/[id]/page; Blood centre console › requests/page; Donor app › app/donations; Hospital console › emergency/page; Hospital console › inventory/page; Hospital console › requests/[id]/page; Hospital console › requests/new/page; Hospital console › requests/page; Hospital console › shipments/[id]/page | Names a blood component on a unit and on a hospital request. Wrong here is the wrong product issued. | PENDING |  |
| `medical.components.PLASMA` | Plasma | Plazma | Плазма | Admin console › inventory/page; Blood centre console › inventory/page; Blood centre console › requests/[id]/page; Blood centre console › requests/page; Donor app › app/donations; Hospital console › emergency/page; Hospital console › inventory/page; Hospital console › requests/[id]/page; Hospital console › requests/new/page; Hospital console › requests/page | Names a blood component on a unit and on a hospital request. Wrong here is the wrong product issued. | PENDING |  |
| `medical.components.PLATELETS` | Platelets | Trombotsitlar | Тромбоциты | Admin console › inventory/page; Blood centre console › inventory/page; Blood centre console › requests/[id]/page; Blood centre console › requests/page; Donor app › app/donations; Hospital console › emergency/page; Hospital console › inventory/page; Hospital console › requests/[id]/page; Hospital console › requests/new/page; Hospital console › requests/page | Names a blood component on a unit and on a hospital request. Wrong here is the wrong product issued. | PENDING |  |
| `medical.components.RED_CELLS` | Red cells | Eritrotsitlar massasi | Эритроцитарная масса | Admin console › inventory/page; Blood centre console › inventory/page; Blood centre console › requests/[id]/page; Blood centre console › requests/page; Donor app › app/donations; Hospital console › emergency/page; Hospital console › inventory/page; Hospital console › requests/[id]/page; Hospital console › requests/new/page; Hospital console › requests/page | Names a blood component on a unit and on a hospital request. Wrong here is the wrong product issued. | PENDING |  |
| `medical.components.WHOLE_BLOOD` | Whole blood | To‘liq qon | Цельная кровь | Admin console › inventory/page; Blood centre console › inventory/page; Blood centre console › requests/[id]/page; Blood centre console › requests/page; Donor app › app/donations; Hospital console › emergency/page; Hospital console › inventory/page; Hospital console › requests/[id]/page; Hospital console › requests/new/page; Hospital console › requests/page | Names a blood component on a unit and on a hospital request. Wrong here is the wrong product issued. | PENDING |  |
| `medical.donationTypes.other` | Other | Boshqa | Другое | Donor app › app/donate | Names the procedure the donor is consenting to. Wrong here is consent to the wrong thing. | PENDING |  |
| `medical.donationTypes.plasma` | Plasma | Plazma | Плазма | Donor app › app/donate | Names the procedure the donor is consenting to. Wrong here is consent to the wrong thing. | PENDING |  |
| `medical.donationTypes.platelets` | Platelets | Trombotsitlar | Тромбоциты | Donor app › app/donate | Names the procedure the donor is consenting to. Wrong here is consent to the wrong thing. | PENDING |  |
| `medical.donationTypes.wholeBlood` | Whole Blood | To‘liq qon | Цельная кровь | Donor app › app/donate | Names the procedure the donor is consenting to. Wrong here is consent to the wrong thing. | PENDING |  |
| `medical.donorStatus.ACTIVE` | Active donor | Faol donor | Активный донор | Not currently rendered | The donor’s standing, including deferral. Wrong here misstates whether they may donate. | PENDING |  |
| `medical.donorStatus.DEFERRED` | Deferred | Vaqtincha chetlatilgan | Отвод | Not currently rendered | The donor’s standing, including deferral. Wrong here misstates whether they may donate. | PENDING |  |
| `medical.donorStatus.INACTIVE` | Inactive | Nofaol | Неактивный | Not currently rendered | The donor’s standing, including deferral. Wrong here misstates whether they may donate. | PENDING |  |
| `medical.eligibility.eligible` | Eligible to donate | Qon topshirishga yaroqli | Допущен к донации | Not currently rendered | Tells a donor whether they may donate, and why not. Wrong here turns away a safe donor or invites an unsafe one. | PENDING |  |
| `medical.eligibility.nextEligibleOn` | Next eligible on {{date}} | Keyingi muddat: {{date}} | Следующая дата: {{date}} | Not currently rendered | Tells a donor whether they may donate, and why not. Wrong here turns away a safe donor or invites an unsafe one. | PENDING |  |
| `medical.eligibility.notYetEligible` | Not yet eligible | Hali yaroqli emas | Пока не допущен | Not currently rendered | Tells a donor whether they may donate, and why not. Wrong here turns away a safe donor or invites an unsafe one. | PENDING |  |
| `medical.eligibility.recoveryPeriod` | Recovery period after your last donation | Oxirgi topshirishdan keyingi tiklanish davri | Период восстановления после последней донации | Not currently rendered | Tells a donor whether they may donate, and why not. Wrong here turns away a safe donor or invites an unsafe one. | PENDING |  |
| `medical.markers.bloodGroupNote` | Your ABO blood group | ABO qon guruhingiz | Ваша группа крови по системе ABO | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.ferritin` | Ferritin | Ferritin | Ферритин | Not currently rendered | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.ferritinNote` | Iron stored in your body | Organizmdagi temir zaxirasi | Запас железа в организме | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.hematocrit` | Haematocrit | Gematokrit | Гематокрит | Not currently rendered | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.hematocritNote` | Proportion of red blood cells | Eritrotsitlar ulushi | Доля эритроцитов | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.hemoglobin` | Haemoglobin | Gemoglobin | Гемоглобин | Not currently rendered | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.hemoglobinNote` | Oxygen-carrying protein | Kislorod tashuvchi oqsil | Белок, переносящий кислород | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.platelets` | Platelets | Trombotsitlar | Тромбоциты | Not currently rendered | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.plateletsNote` | Helps with blood clotting | Qon ivishiga yordam beradi | Участвуют в свёртывании крови | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.redBloodCells` | Red blood cells | Eritrotsitlar | Эритроциты | Not currently rendered | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.redBloodCellsNote` | Carries oxygen throughout the body | Butun tana bo‘ylab kislorod tashiydi | Переносят кислород по организму | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.rhFactorNote` | Rh positive or negative | Rezus musbat yoki manfiy | Резус положительный или отрицательный | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.whiteBloodCells` | White blood cells | Leykotsitlar | Лейкоциты | Not currently rendered | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.markers.whiteBloodCellsNote` | Helps fight infection | Infeksiyaga qarshi kurashishga yordam beradi | Помогают бороться с инфекцией | Donor app › app/health | Names a laboratory measurement of the donor’s own blood. | PENDING |  |
| `medical.preparation.bringId` | Bring a valid ID document | Amaldagi shaxsni tasdiqlovchi hujjatni olib keling | Возьмите действующий документ, удостоверяющий личность | Donor app › app/appointment/[id] | What a donor should do before donating. Wrong here affects both the donation and the donor. | PENDING |  |
| `medical.preparation.eatWell` | Eat a healthy meal 2-3 hours before | Kelishdan 2-3 soat oldin to‘yimli ovqatlaning | Поешьте за 2-3 часа до визита | Donor app › app/appointment/[id] | What a donor should do before donating. Wrong here affects both the donation and the donor. | PENDING |  |
| `medical.preparation.hydrate` | Drink plenty of water the night before | Bir kun oldin kechqurun ko‘p suv iching | Накануне вечером пейте больше воды | Donor app › app/appointment/[id] | What a donor should do before donating. Wrong here affects both the donation and the donor. | PENDING |  |
| `medical.preparation.noAlcohol` | Avoid alcohol for 24 hours prior | Oldingi 24 soat ichida spirtli ichimlikdan saqlaning | Не употребляйте алкоголь за 24 часа до визита | Donor app › app/appointment/[id] | What a donor should do before donating. Wrong here affects both the donation and the donor. | PENDING |  |
| `medical.preparation.wearComfortable` | Wear comfortable, loose clothing | Qulay, keng kiyim kiying | Наденьте удобную свободную одежду | Donor app › app/appointment/[id] | What a donor should do before donating. Wrong here affects both the donation and the donor. | PENDING |  |
| `medical.reference.currentValue` | Current value | Joriy qiymat | Текущее значение | Donor app › app/health-trends | Explains a reference range to a donor reading their own result. | PENDING |  |
| `medical.reference.lastMeasured` | Last measured {{date}} | Oxirgi o‘lchov: {{date}} | Последнее измерение: {{date}} | Not currently rendered | Explains a reference range to a donor reading their own result. | PENDING |  |
| `medical.reference.referenceRange` | Reference range | Me’yoriy oraliq | Референсный интервал | Donor app › app/health-trends | Explains a reference range to a donor reading their own result. | PENDING |  |
| `medical.reference.referenceUnavailable` | Reference range unavailable | Me’yoriy oraliq mavjud emas | Референсный интервал недоступен | Donor app › app/health-trends | Explains a reference range to a donor reading their own result. | PENDING |  |
| `medical.reference.trend` | Trend | Dinamika | Динамика | Not currently rendered | Explains a reference range to a donor reading their own result. | PENDING |  |
| `medical.resultFlags.noReference` | No reference range | Me’yoriy oraliq yo‘q | Нет референсного интервала | Not currently rendered | Tells a donor whether a result of theirs is normal. Wrong here is read as reassurance or as alarm about their health. | PENDING |  |
| `medical.resultFlags.normal` | Normal | Me’yorda | В норме | Donor app › app/health | Tells a donor whether a result of theirs is normal. Wrong here is read as reassurance or as alarm about their health. | PENDING |  |
| `medical.resultFlags.outsideRange` | Outside healthy range | Me’yordan tashqarida | Вне нормы | Donor app › app/health | Tells a donor whether a result of theirs is normal. Wrong here is read as reassurance or as alarm about their health. | PENDING |  |
| `medical.resultFlagsByCode.ABNORMAL` | Outside healthy range | Me’yordan tashqarida | Вне нормы | Donor app › app/health-trends | The same flags keyed by the code the API sends. Must not drift from resultFlags. | PENDING |  |
| `medical.resultFlagsByCode.CRITICAL` | Critical | Kritik | Критическое | Admin console › requests/page; Blood centre console › page; Donor app › app/health-trends; Hospital console › page | The same flags keyed by the code the API sends. Must not drift from resultFlags. | PENDING |  |
| `medical.resultFlagsByCode.HIGH` | Above range | Me’yordan yuqori | Выше нормы | Donor app › app/health-trends | The same flags keyed by the code the API sends. Must not drift from resultFlags. | PENDING |  |
| `medical.resultFlagsByCode.LOW` | Below range | Me’yordan past | Ниже нормы | Donor app › app/health-trends | The same flags keyed by the code the API sends. Must not drift from resultFlags. | PENDING |  |
| `medical.resultFlagsByCode.NORMAL` | Normal | Me’yorda | В норме | Donor app › app/health-trends | The same flags keyed by the code the API sends. Must not drift from resultFlags. | PENDING |  |
| `medical.resultFlagsByCode.NOT_AVAILABLE` | Not available | Mavjud emas | Нет данных | Donor app › app/health-trends | The same flags keyed by the code the API sends. Must not drift from resultFlags. | PENDING |  |
| `medical.rhFactor` | Rh factor | Rezus omil | Резус-фактор | Blood centre console › inventory/page; Hospital console › emergency/page; Hospital console › inventory/page; Hospital console › requests/new/page | Shown to a donor or to staff in a clinical context. | PENDING |  |
| `medical.rhNegative` | Rh negative | Rezus manfiy | Резус отрицательный | Not currently rendered | Shown to a donor or to staff in a clinical context. | PENDING |  |
| `medical.rhPositive` | Rh positive | Rezus musbat | Резус положительный | Not currently rendered | Shown to a donor or to staff in a clinical context. | PENDING |  |
| `medical.services.BLOOD_TYPING` | Blood typing | Qon guruhini aniqlash | Определение группы крови | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.EMERGENCY_SUPPLY` | Emergency supply | Shoshilinch ta’minot | Экстренное снабжение | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.HEALTH_SCREENING` | Health screening | Sog‘liqni tekshirish | Медицинский осмотр | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.LABORATORY_TESTING` | Laboratory testing | Laboratoriya tekshiruvi | Лабораторные исследования | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.MOBILE_DONATION_DRIVE` | Mobile donation drive | Ko‘chma qon topshirish aksiyasi | Выездная донорская акция | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.PLASMA_DONATION` | Plasma donation | Plazma topshirish | Сдача плазмы | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.PLATELET_DONATION` | Platelet donation | Trombotsit topshirish | Сдача тромбоцитов | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.services.WHOLE_BLOOD_DONATION` | Whole blood donation | To‘liq qon topshirish | Сдача цельной крови | Admin console › organizations/page; Blood centre console › organization/page; Donor app › booking/organizations; Hospital console › organization/page | What a site actually offers. Wrong here sends a donor to the wrong building. | PENDING |  |
| `medical.testCategories.BLOOD_GROUP` | Blood group | Qon guruhi | Группа крови | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.DIABETES` | Diabetes | Qandli diabet | Диабет | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.GENERAL` | General | Umumiy | Общее | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.HEMATOLOGY` | Haematology | Gematologiya | Гематология | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.IRON` | Iron studies | Temir ko‘rsatkichlari | Показатели железа | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.KIDNEY_FUNCTION` | Kidney function | Buyrak funksiyasi | Функция почек | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.LIPID` | Lipids | Lipidlar | Липиды | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.LIVER_FUNCTION` | Liver function | Jigar funksiyasi | Функция печени | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.OTHER` | Other | Boshqa | Другое | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.testCategories.THYROID` | Thyroid | Qalqonsimon bez | Щитовидная железа | Not currently rendered | Groups tests on the donor’s own results screen. | PENDING |  |
| `medical.trendDirection.DECREASING` | Value has decreased | Qiymat kamaygan | Значение снизилось | Donor app › app/health-trends | Whether one of the donor’s own measurements is rising or falling over time. | PENDING |  |
| `medical.trendDirection.INCREASING` | Value has increased | Qiymat oshgan | Значение выросло | Donor app › app/health-trends | Whether one of the donor’s own measurements is rising or falling over time. | PENDING |  |
| `medical.trendDirection.INSUFFICIENT_DATA` | Not enough data for a trend | Tendensiya uchun ma’lumot yetarli emas | Недостаточно данных для тренда | Donor app › app/health-trends | Whether one of the donor’s own measurements is rising or falling over time. | PENDING |  |
| `medical.trendDirection.STABLE` | Value has remained relatively stable | Qiymat nisbatan barqaror | Значение относительно стабильно | Donor app › app/health-trends | Whether one of the donor’s own measurements is rising or falling over time. | PENDING |  |
| `medical.verification.REQUIRES_REVIEW` | Needs review | Qayta ko‘rib chiqish kerak | Требует проверки | Not currently rendered | Whether a donor’s blood group has been confirmed, and by whom. Wrong here misstates how far the group can be trusted. | PENDING |  |
| `medical.verification.UNVERIFIED` | Blood type not verified | Qon guruhi tasdiqlanmagan | Группа крови не подтверждена | Not currently rendered | Whether a donor’s blood group has been confirmed, and by whom. Wrong here misstates how far the group can be trusted. | PENDING |  |
| `medical.verification.VERIFIED` | Blood type verified | Qon guruhi tasdiqlangan | Группа крови подтверждена | Not currently rendered | Whether a donor’s blood group has been confirmed, and by whom. Wrong here misstates how far the group can be trusted. | PENDING |  |
| `medical.verification.notSureSkip` | Not sure? Skip this — you can always set it later, and a blood centre confirms it at your first donation either way. | Bilmaysizmi? Bu qadamni o‘tkazib yuboring — keyinroq kiritishingiz mumkin, qon markazi birinchi qon topshirishingizda uni baribir tasdiqlaydi. | Не уверены? Пропустите этот шаг — указать можно позже, и центр крови всё равно подтвердит группу при первой сдаче. | Donor app › onboarding/complete-profile | Whether a donor’s blood group has been confirmed, and by whom. Wrong here misstates how far the group can be trusted. | PENDING |  |
| `medical.verification.unverifiedNote` | Your blood type stays marked unverified until an authorized healthcare provider confirms it. | Qon guruhingiz vakolatli tibbiyot xodimi tasdiqlamaguncha tasdiqlanmagan deb belgilanadi. | Ваша группа крови остаётся неподтверждённой, пока её не подтвердит уполномоченный медицинский работник. | Donor app › app/profile/donor | Whether a donor’s blood group has been confirmed, and by whom. Wrong here misstates how far the group can be trusted. | PENDING |  |

---

_Generated by `pnpm clinical:review` from `packages/i18n/src/locales`. Do not
edit the first four columns by hand — edit the catalogue and regenerate._
