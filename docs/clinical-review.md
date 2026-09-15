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

1. Read the English source. If the English itself is wrong or misleading, say so
   in Notes — that is the more important finding.
2. Check the Uzbek and Russian say the same clinical thing, not merely a
   similar-sounding thing.
3. Set Status to `APPROVED` or `CHANGE REQUESTED`, and put the replacement
   wording in Notes.
4. Re-running `pnpm clinical:review` preserves both columns, so sign-off is
   not lost when a new term is added.

Nothing here should be edited in the catalogue without a reviewer's decision
recorded in this file.

## Terms

| Translation key | English source | Uzbek (Latin) | Russian | Status | Reviewer notes |
| --- | --- | --- | --- | --- | --- |
| `medical.advice.askYourProvider` | Questions for your healthcare provider | Shifokoringizga beriladigan savollar | Вопросы для вашего врача | PENDING |  |
| `medical.advice.discussResults` | Discuss your results with a healthcare professional. | Natijalaringizni shifokor bilan muhokama qiling. | Обсудите результаты с врачом. | PENDING |  |
| `medical.advice.notMedicalAdvice` | This is general information, not medical advice. | Bu umumiy ma’lumot, tibbiy maslahat emas. | Это общая информация, а не медицинская консультация. | PENDING |  |
| `medical.aiInsightTypes.APPOINTMENT_INSIGHT` | Appointment insight | Uchrashuv haqida | О записи | PENDING |  |
| `medical.aiInsightTypes.DATA_CHANGE` | Change in your data | Ma’lumotlaringizdagi o‘zgarish | Изменение в данных | PENDING |  |
| `medical.aiInsightTypes.DATA_QUALITY_WARNING` | Data quality warning | Ma’lumot sifati haqida ogohlantirish | Предупреждение о качестве данных | PENDING |  |
| `medical.aiInsightTypes.DONATION_INSIGHT` | Donation insight | Qon topshirish haqida | О донациях | PENDING |  |
| `medical.aiInsightTypes.GENERAL_HEALTH_INFORMATION` | General health information | Umumiy sog‘liq ma’lumoti | Общая информация о здоровье | PENDING |  |
| `medical.aiInsightTypes.HEALTH_SUMMARY` | Health summary | Salomatlik xulosasi | Сводка о здоровье | PENDING |  |
| `medical.aiInsightTypes.QUESTION_SUGGESTION` | Questions to ask | Beriladigan savollar | Вопросы, которые стоит задать | PENDING |  |
| `medical.aiInsightTypes.REFERENCE_RANGE_CONTEXT` | Reference range context | Me’yoriy oraliq izohi | Пояснение к референсному диапазону | PENDING |  |
| `medical.aiInsightTypes.RESULT_EXPLANATION` | Result explanation | Natija izohi | Пояснение результата | PENDING |  |
| `medical.aiInsightTypes.TREND_SUMMARY` | Trend summary | Dinamika xulosasi | Сводка динамики | PENDING |  |
| `medical.aiInsightTypes.WEEKLY_SUMMARY` | Weekly summary | Haftalik xulosa | Недельная сводка | PENDING |  |
| `medical.aiSafety.EMERGENCY_REDIRECT` | Seek medical help now | Zudlik bilan tibbiy yordamga murojaat qiling | Немедленно обратитесь за медицинской помощью | PENDING |  |
| `medical.aiSafety.NEEDS_CONTEXT` | Needs more context | Qo‘shimcha ma’lumot kerak | Нужен дополнительный контекст | PENDING |  |
| `medical.aiSafety.OUT_OF_SCOPE` | Outside what this can answer | Bu savolga javob bera olmaydi | Вне рамок того, на что можно ответить | PENDING |  |
| `medical.aiSafety.PROFESSIONAL_REVIEW_SUGGESTED` | Discuss with a healthcare professional | Shifokor bilan maslahatlashing | Обсудите с врачом | PENDING |  |
| `medical.aiSafety.SAFE_INFORMATIONAL` | Informational | Ma’lumot uchun | Информационно | PENDING |  |
| `medical.aiSafety.disclaimer` | AI-generated informational content, drawn from your own recorded health data. It is not a medical diagnosis — always consult your doctor. | Bu — sizning qayd etilgan sog‘liq ma’lumotlaringiz asosida AI yaratgan ma’lumot. Bu tibbiy tashxis emas — har doim shifokoringiz bilan maslahatlashing. | Это информационный текст, сгенерированный ИИ на основе ваших записанных данных о здоровье. Это не медицинский диагноз — всегда консультируйтесь с врачом. | PENDING |  |
| `medical.appointmentTypes.bloodDonation` | Donation | Qon topshirish | Донация | PENDING |  |
| `medical.appointmentTypes.bloodTest` | Blood test | Qon tahlili | Анализ крови | PENDING |  |
| `medical.appointmentTypes.consultation` | Consultation | Konsultatsiya | Консультация | PENDING |  |
| `medical.assessment.APPROVED_FOR_DONATION` | Cleared to donate | Qon topshirishga ruxsat berildi | Допущен к донации | PENDING |  |
| `medical.assessment.DEFERRED` | Deferred | Vaqtincha chetlatilgan | Отвод | PENDING |  |
| `medical.assessment.NOT_COMPLETED` | Not completed | Yakunlanmagan | Не завершено | PENDING |  |
| `medical.bloodGroup` | Blood group | Qon guruhi | Группа крови | PENDING |  |
| `medical.components.OTHER` | Other | Boshqa | Другое | PENDING |  |
| `medical.components.PLASMA` | Plasma | Plazma | Плазма | PENDING |  |
| `medical.components.PLATELETS` | Platelets | Trombotsitlar | Тромбоциты | PENDING |  |
| `medical.components.RED_CELLS` | Red cells | Eritrotsitlar massasi | Эритроцитарная масса | PENDING |  |
| `medical.components.WHOLE_BLOOD` | Whole blood | To‘liq qon | Цельная кровь | PENDING |  |
| `medical.donationTypes.other` | Other | Boshqa | Другое | PENDING |  |
| `medical.donationTypes.plasma` | Plasma | Plazma | Плазма | PENDING |  |
| `medical.donationTypes.platelets` | Platelets | Trombotsitlar | Тромбоциты | PENDING |  |
| `medical.donationTypes.wholeBlood` | Whole Blood | To‘liq qon | Цельная кровь | PENDING |  |
| `medical.donorStatus.ACTIVE` | Active donor | Faol donor | Активный донор | PENDING |  |
| `medical.donorStatus.DEFERRED` | Deferred | Vaqtincha chetlatilgan | Отвод | PENDING |  |
| `medical.donorStatus.INACTIVE` | Inactive | Nofaol | Неактивный | PENDING |  |
| `medical.eligibility.eligible` | Eligible to donate | Qon topshirishga yaroqli | Допущен к донации | PENDING |  |
| `medical.eligibility.nextEligibleOn` | Next eligible on {{date}} | Keyingi muddat: {{date}} | Следующая дата: {{date}} | PENDING |  |
| `medical.eligibility.notYetEligible` | Not yet eligible | Hali yaroqli emas | Пока не допущен | PENDING |  |
| `medical.eligibility.recoveryPeriod` | Recovery period after your last donation | Oxirgi topshirishdan keyingi tiklanish davri | Период восстановления после последней донации | PENDING |  |
| `medical.markers.bloodGroupNote` | Your ABO blood group | ABO qon guruhingiz | Ваша группа крови по системе ABO | PENDING |  |
| `medical.markers.ferritin` | Ferritin | Ferritin | Ферритин | PENDING |  |
| `medical.markers.ferritinNote` | Iron stored in your body | Organizmdagi temir zaxirasi | Запас железа в организме | PENDING |  |
| `medical.markers.hematocrit` | Haematocrit | Gematokrit | Гематокрит | PENDING |  |
| `medical.markers.hematocritNote` | Proportion of red blood cells | Eritrotsitlar ulushi | Доля эритроцитов | PENDING |  |
| `medical.markers.hemoglobin` | Haemoglobin | Gemoglobin | Гемоглобин | PENDING |  |
| `medical.markers.hemoglobinNote` | Oxygen-carrying protein | Kislorod tashuvchi oqsil | Белок, переносящий кислород | PENDING |  |
| `medical.markers.platelets` | Platelets | Trombotsitlar | Тромбоциты | PENDING |  |
| `medical.markers.plateletsNote` | Helps with blood clotting | Qon ivishiga yordam beradi | Участвуют в свёртывании крови | PENDING |  |
| `medical.markers.redBloodCells` | Red blood cells | Eritrotsitlar | Эритроциты | PENDING |  |
| `medical.markers.redBloodCellsNote` | Carries oxygen throughout the body | Butun tana bo‘ylab kislorod tashiydi | Переносят кислород по организму | PENDING |  |
| `medical.markers.rhFactorNote` | Rh positive or negative | Rezus musbat yoki manfiy | Резус положительный или отрицательный | PENDING |  |
| `medical.markers.whiteBloodCells` | White blood cells | Leykotsitlar | Лейкоциты | PENDING |  |
| `medical.markers.whiteBloodCellsNote` | Helps fight infection | Infeksiyaga qarshi kurashishga yordam beradi | Помогают бороться с инфекцией | PENDING |  |
| `medical.preparation.bringId` | Bring a valid ID document | Amaldagi shaxsni tasdiqlovchi hujjatni olib keling | Возьмите действующий документ, удостоверяющий личность | PENDING |  |
| `medical.preparation.eatWell` | Eat a healthy meal 2-3 hours before | Kelishdan 2-3 soat oldin to‘yimli ovqatlaning | Поешьте за 2-3 часа до визита | PENDING |  |
| `medical.preparation.hydrate` | Drink plenty of water the night before | Bir kun oldin kechqurun ko‘p suv iching | Накануне вечером пейте больше воды | PENDING |  |
| `medical.preparation.noAlcohol` | Avoid alcohol for 24 hours prior | Oldingi 24 soat ichida spirtli ichimlikdan saqlaning | Не употребляйте алкоголь за 24 часа до визита | PENDING |  |
| `medical.preparation.wearComfortable` | Wear comfortable, loose clothing | Qulay, keng kiyim kiying | Наденьте удобную свободную одежду | PENDING |  |
| `medical.reference.currentValue` | Current value | Joriy qiymat | Текущее значение | PENDING |  |
| `medical.reference.lastMeasured` | Last measured {{date}} | Oxirgi o‘lchov: {{date}} | Последнее измерение: {{date}} | PENDING |  |
| `medical.reference.referenceRange` | Reference range | Me’yoriy oraliq | Референсный интервал | PENDING |  |
| `medical.reference.referenceUnavailable` | Reference range unavailable | Me’yoriy oraliq mavjud emas | Референсный интервал недоступен | PENDING |  |
| `medical.reference.trend` | Trend | Dinamika | Динамика | PENDING |  |
| `medical.resultFlags.noReference` | No reference range | Me’yoriy oraliq yo‘q | Нет референсного интервала | PENDING |  |
| `medical.resultFlags.normal` | Normal | Me’yorda | В норме | PENDING |  |
| `medical.resultFlags.outsideRange` | Outside healthy range | Me’yordan tashqarida | Вне нормы | PENDING |  |
| `medical.resultFlagsByCode.ABNORMAL` | Outside healthy range | Me’yordan tashqarida | Вне нормы | PENDING |  |
| `medical.resultFlagsByCode.CRITICAL` | Critical | Kritik | Критическое | PENDING |  |
| `medical.resultFlagsByCode.HIGH` | Above range | Me’yordan yuqori | Выше нормы | PENDING |  |
| `medical.resultFlagsByCode.LOW` | Below range | Me’yordan past | Ниже нормы | PENDING |  |
| `medical.resultFlagsByCode.NORMAL` | Normal | Me’yorda | В норме | PENDING |  |
| `medical.resultFlagsByCode.NOT_AVAILABLE` | Not available | Mavjud emas | Нет данных | PENDING |  |
| `medical.rhFactor` | Rh factor | Rezus omil | Резус-фактор | PENDING |  |
| `medical.rhNegative` | Rh negative | Rezus manfiy | Резус отрицательный | PENDING |  |
| `medical.rhPositive` | Rh positive | Rezus musbat | Резус положительный | PENDING |  |
| `medical.services.BLOOD_TYPING` | Blood typing | Qon guruhini aniqlash | Определение группы крови | PENDING |  |
| `medical.services.EMERGENCY_SUPPLY` | Emergency supply | Shoshilinch ta’minot | Экстренное снабжение | PENDING |  |
| `medical.services.HEALTH_SCREENING` | Health screening | Sog‘liqni tekshirish | Медицинский осмотр | PENDING |  |
| `medical.services.LABORATORY_TESTING` | Laboratory testing | Laboratoriya tekshiruvi | Лабораторные исследования | PENDING |  |
| `medical.services.MOBILE_DONATION_DRIVE` | Mobile donation drive | Ko‘chma qon topshirish aksiyasi | Выездная донорская акция | PENDING |  |
| `medical.services.PLASMA_DONATION` | Plasma donation | Plazma topshirish | Сдача плазмы | PENDING |  |
| `medical.services.PLATELET_DONATION` | Platelet donation | Trombotsit topshirish | Сдача тромбоцитов | PENDING |  |
| `medical.services.WHOLE_BLOOD_DONATION` | Whole blood donation | To‘liq qon topshirish | Сдача цельной крови | PENDING |  |
| `medical.testCategories.BLOOD_GROUP` | Blood group | Qon guruhi | Группа крови | PENDING |  |
| `medical.testCategories.DIABETES` | Diabetes | Qandli diabet | Диабет | PENDING |  |
| `medical.testCategories.GENERAL` | General | Umumiy | Общее | PENDING |  |
| `medical.testCategories.HEMATOLOGY` | Haematology | Gematologiya | Гематология | PENDING |  |
| `medical.testCategories.IRON` | Iron studies | Temir ko‘rsatkichlari | Показатели железа | PENDING |  |
| `medical.testCategories.KIDNEY_FUNCTION` | Kidney function | Buyrak funksiyasi | Функция почек | PENDING |  |
| `medical.testCategories.LIPID` | Lipids | Lipidlar | Липиды | PENDING |  |
| `medical.testCategories.LIVER_FUNCTION` | Liver function | Jigar funksiyasi | Функция печени | PENDING |  |
| `medical.testCategories.OTHER` | Other | Boshqa | Другое | PENDING |  |
| `medical.testCategories.THYROID` | Thyroid | Qalqonsimon bez | Щитовидная железа | PENDING |  |
| `medical.trendDirection.DECREASING` | Value has decreased | Qiymat kamaygan | Значение снизилось | PENDING |  |
| `medical.trendDirection.INCREASING` | Value has increased | Qiymat oshgan | Значение выросло | PENDING |  |
| `medical.trendDirection.INSUFFICIENT_DATA` | Not enough data for a trend | Tendensiya uchun ma’lumot yetarli emas | Недостаточно данных для тренда | PENDING |  |
| `medical.trendDirection.STABLE` | Value has remained relatively stable | Qiymat nisbatan barqaror | Значение относительно стабильно | PENDING |  |
| `medical.verification.REQUIRES_REVIEW` | Needs review | Qayta ko‘rib chiqish kerak | Требует проверки | PENDING |  |
| `medical.verification.UNVERIFIED` | Blood type not verified | Qon guruhi tasdiqlanmagan | Группа крови не подтверждена | PENDING |  |
| `medical.verification.VERIFIED` | Blood type verified | Qon guruhi tasdiqlangan | Группа крови подтверждена | PENDING |  |
| `medical.verification.notSureSkip` | Not sure? Skip this — you can always set it later, and a blood centre confirms it at your first donation either way. | Bilmaysizmi? Bu qadamni o‘tkazib yuboring — keyinroq kiritishingiz mumkin, qon markazi birinchi qon topshirishingizda uni baribir tasdiqlaydi. | Не уверены? Пропустите этот шаг — указать можно позже, и центр крови всё равно подтвердит группу при первой сдаче. | PENDING |  |
| `medical.verification.unverifiedNote` | Your blood type stays marked unverified until an authorized healthcare provider confirms it. | Qon guruhingiz vakolatli tibbiyot xodimi tasdiqlamaguncha tasdiqlanmagan deb belgilanadi. | Ваша группа крови остаётся неподтверждённой, пока её не подтвердит уполномоченный медицинский работник. | PENDING |  |

---

_Generated by `pnpm clinical:review` from `packages/i18n/src/locales`. Do not
edit the first four columns by hand — edit the catalogue and regenerate._
