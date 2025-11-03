import React, { useMemo, useState, useEffect } from "react";

/* ============================ 공통 포맷터 ============================ */
const fmtUSD0 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtUSD3 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n || 0);

const fmtKRW = (n: number, rate: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Math.round((n || 0) * rate));

const fmtKRWwon = (n: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));

/* ============================ Genesys 상수 ============================ */
const UNIT = {
  callbotPerMinuteUSD: 0.06,
  chatbotPerSessionUSD: 0.02,
  advisorSTTPerMinuteUSD: 0.01,
  advisorTokenPerEachUSD: 1,
} as const;

const STT_FREE_MIN_PER_SEAT: Record<"CX1" | "CX2" | "CX3" | "CX4", number> = {
  CX1: 100,
  CX2: 100,
  CX3: 1500,
  CX4: 3000,
};
const ADDON_STT_MIN_PER_PACK = 1400;

/* ============================ AWS 상수 ============================ */
const AWS_RATE = {
  chatbotPerSessionUSD: 0.01,
  voicePerMinuteUSD: 0.038,
  taqaPerMinuteUSD: 0.033,

  // 👈 [수정] Amazon Connect 제외 단가 추가 
  chatbotPerSessionUSD_NoAC: 0.006,
  voicePerMinuteUSD_NoAC: 0.02,
  taqaPerMinuteUSD_NoAC: 0.015,
};

/* ============================ ECP-AI 상수(월) ============================ */
const ECP_UNIT_KRW = {
  callbotPerChannel: 110_000,
  chatbotPerChannel: 50_000,
  advisorPerSeat: 70_000,
  taPerSeat: 25_000,
  qaPerSeat: 25_000,
  kmsPerSeat: 25_000,
  sttPerChannel: 15_000,
  ttsPerChannel: 20_000,
} as const;

/* ============================ ★ 공통 영속 유틸(localStorage) ============================ */
const LS_KEYS = {
  GLOBAL: "pricing.globalDefaults.v1",
  GENESYS: "pricing.genesys.defaults.v1",
  AWS: "pricing.aws.defaults.v1",
  ECP: "pricing.ecp.defaults.v1",
} as const;

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}
function lsSave<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* ============================ 메인 앱 ============================ */
export default function PricingApp() {
  // 전역 연동 입력
  const [globalChatbotChannels, setGlobalChatbotChannels] = useState<number | undefined>(undefined);
  const [globalCallbotChannels, setGlobalCallbotChannels] = useState<number | undefined>(undefined);
  const [globalAdvisorSeats, setGlobalAdvisorSeats] = useState<number | undefined>(undefined);
  const [globalTaQaChannels, setGlobalTaQaChannels] = useState<number | undefined>(undefined); // 👈 [수정] TA/QA 상태 추가

  // ★ 최초 로드 시 전역 기본값 복원
  useEffect(() => {
    const d = lsLoad(LS_KEYS.GLOBAL, {
      globalChatbotChannels: 0,
      globalCallbotChannels: 0,
      globalAdvisorSeats: 0,
      globalTaQaChannels: 0, // 👈 [수정] TA/QA 로드
    });
    setGlobalChatbotChannels(d.globalChatbotChannels);
    setGlobalCallbotChannels(d.globalCallbotChannels);
    setGlobalAdvisorSeats(d.globalAdvisorSeats);
    setGlobalTaQaChannels(d.globalTaQaChannels); // 👈 [수정] TA/QA 로드
  }, []);

  // 상단 합계(원) – 자식 계산기에서 실시간 업데이트
  const [gTotalKRW, setGTotalKRW] = useState(0);
  const [gTotalNoSubKRW, setGTotalNoSubKRW] = useState(0);
  const [aTotalKRW, setATotalKRW] = useState(0);
  const [aTotalNoAcKRW, setATotalNoAcKRW] = useState(0);
  const [eTotalKRW, setETotalKRW] = useState(0);

  // ★ 전역 입력값 저장 버튼
  const saveGlobalDefaults = () => {
    lsSave(LS_KEYS.GLOBAL, {
      globalChatbotChannels: globalChatbotChannels ?? 0,
      globalCallbotChannels: globalCallbotChannels ?? 0,
      globalAdvisorSeats: globalAdvisorSeats ?? 0,
      globalTaQaChannels: globalTaQaChannels ?? 0, // 👈 [수정] TA/QA 저장
    });
    alert("전체 입력(연동) 기본값을 저장했어요.");
  };

  return (
    <div style={page()}>
      {/* ── 상단 공통: 구글 시트 링크 바 ── */}
      <div style={sheetBar()}>
        <span style={{ fontWeight: 700 }}>구글 스프레드 시트 :&nbsp;</span>
        <a
          href="https://docs.google.com/spreadsheets/d/1TZ7kNZak_9ayn4nYGn3XEkJCb5IoLLMYo7kvloweLII/edit?gid=589006119#gid=589006119"
          target="_blank"
          rel="noreferrer noopener"
          style={sheetLink()}
          title="Google Sheets 열기"
        >
          https://docs.google.com/spreadsheets/d/1TZ7kNZak_9ayn4nYGn3XEkJCb5IoLLMYo7kvloweLII/edit?gid=589006119#gid=589006119
        </a>
      </div>

      {/* ── 상단 2열: 좌측 입력 · 우측 합계 ── */}
      <div style={topGrid()}>
        {/* 좌측: 전체 입력(연동) */}
        <div style={{ ...container(), padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ ...title(), marginBottom: 8, fontSize: 24 }}>전체 입력(연동)</h1>
            <button type="button" onClick={saveGlobalDefaults} style={saveBtn()}>
              저장
            </button>
          </div>
          <div style={noteBox()}>
            여기 입력하면 아래 <b>Genesys / AWS / ECP-AI</b> 계산기의 <b>채널/좌석 수</b>가 함께 갱신됩니다.
            (각 계산기에서 개별로 수정해도 전역값은 바뀌지 않아요)
          </div>

          <Field label="전체 챗봇 채널 수">
            <NumberBox value={globalChatbotChannels ?? 0} onChange={setGlobalChatbotChannels} />
          </Field>
          <Field label="전체 콜봇 채널 수">
            <NumberBox value={globalCallbotChannels ?? 0} onChange={setGlobalCallbotChannels} />
          </Field>
          <Field label="전체 어드바이저 좌석수(QA/TA/KMS 포함)">
            <NumberBox value={globalAdvisorSeats ?? 0} onChange={setGlobalAdvisorSeats} />
          </Field>
          {/* 👈 [수정] TA/QA 입력 필드 추가 */}
          <Field label="전체 TA/QA (Genesys 제외)">
            <NumberBox value={globalTaQaChannels ?? 0} onChange={setGlobalTaQaChannels} />
          </Field>
        </div>

        {/* 우측: 합계(월) */}
        <div style={{ ...container(), padding: 16 }}>
  <h1 style={{ ...title(), marginBottom: 8, fontSize: 24 }}>합계(월)</h1>
  <div style={{ fontSize: 14, color: "#334155", marginBottom: 8 }}>
    아래 섹션과 연동된 최종 월 합계를 <b>원화</b>로 바로 보여줘요. (할인/환율/마진 반영)
  </div>

  <QuickTotal
    warn="정보 제한, 정확성 X, 참고용 가격"  // 🔴 박스 안 맨 위 빨간 줄
    label="제네시스 총합계 (원) (토큰 사용 시 가격 변동 有)"
    valueKRW={gTotalKRW}
    subLabel="구독료 제외 "
    subValueKRW={gTotalNoSubKRW}
  />

  <QuickTotal
    label="AWS 총합계 (원)"
    valueKRW={aTotalKRW}
  	subLabel="Amazon connect 제외 "
  	subValueKRW={aTotalNoAcKRW}
  />

  <QuickTotal label="ECP-AI 총합계 (원)" valueKRW={eTotalKRW} />
</div>
  	  </div>

  	  {/* 3열 그리드 */}
  	  <div style={grid3Col()}>
  	 	<div style={container()}>
  	 	  <GenesysCalculator
  	 	 	linkedChatbotChannels={globalChatbotChannels}
  	 	 	linkedCallbotChannels={globalCallbotChannels}
  	 	 	linkedAdvisorSeats={globalAdvisorSeats}
  	 	 	onTotalKRWChange={(totalKRW, noSubKRW) => {
  	 	 	  setGTotalKRW(totalKRW);
  	 	 	  if (typeof noSubKRW === "number") setGTotalNoSubKRW(noSubKRW);
  	 	 	}}
  	 	  />
  	 	</div>
  	 	<div style={container()}>
  	 	  <AwsCalculator
  	 	 	linkedChatbotChannels={globalChatbotChannels}
  	 	 	linkedCallbotChannels={globalCallbotChannels}
  	 	 	linkedAdvisorSeats={globalAdvisorSeats}
  	 	 	linkedTaQaChannels={globalTaQaChannels} // 👈 [수정] TA/QA prop 전달
  	 	 	onTotalKRWChange={(totalKRW, totalNoAcKRW) => {
  	 	 	  setATotalKRW(totalKRW);
  	 	 	  if (typeof totalNoAcKRW === "number") {
  	 	 	 	setATotalNoAcKRW(totalNoAcKRW);
  	 	 	  }
  	 	 	}}
  	 	  />
  	 	</div>
  	 	<div style={container()}>
  	 	  <EcpAiCalculator
  	 	 	linkedChatbotChannels={globalChatbotChannels}
  	 	 	linkedCallbotChannels={globalCallbotChannels}
  	 	 	linkedAdvisorSeats={globalAdvisorSeats}
  	 	 	linkedTaQaChannels={globalTaQaChannels} // 👈 [수정] TA/QA prop 전달
  	 	 	onTotalKRWChange={setETotalKRW}
  	 	  />
  	 	</div>
  	  </div>
  	</div>
  );
}

/* ============================ Genesys 계산기 (수정됨) ============================ */
function GenesysCalculator(props: {
  linkedChatbotChannels?: number;
  linkedCallbotChannels?: number;
  linkedAdvisorSeats?: number;
  onTotalKRWChange?: (krw: number, krwNoSub?: number) => void;
}) {
  // 최상단: 할인/환율
  const [discountRate, setDiscountRate] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1400);

  // CX 패키지 가격/무료토큰 (동적)
  const [pkgPrice, setPkgPrice] = useState<Record<"CX1" | "CX2" | "CX3" | "CX4", number>>({
  	CX1: 75,
  	CX2: 115,
  	CX3: 155,
  	CX4: 240,
  });
  const [pkgFreeToken, setPkgFreeToken] = useState<Record<"CX1" | "CX2" | "CX3" | "CX4", number>>({
  	CX1: 0,
  	CX2: 0,
  	CX3: 0,
  	CX4: 30,
  });

  // 일반 입력
  const [cxPackage, setCxPackage] = useState<"CX1" | "CX2" | "CX3" | "CX4">("CX4");
  const [sttAddOnPacks, setSttAddOnPacks] = useState(0);

  // 챗봇
  const [chatbotChannels, setChatbotChannels] = useState(0);
  const [chatbotConsultsPerDay, setChatbotConsultsPerDay] = useState(100);
  const [chatbotSessionsPerConsult, setChatbotSessionsPerConsult] = useState(5);
  const [daysChatbotPerMonth, setDaysChatbotPerMonth] = useState(25);

  // 콜봇
  const [callbotChannels, setCallbotChannels] = useState(0);
  const [callbotAvgCallMin, setCallbotAvgCallMin] = useState(3);
  const [callbotAnsweredPerDay, setCallbotAnsweredPerDay] = useState(100);
  const [daysCallbotPerMonth, setDaysCallbotPerMonth] = useState(25);

  // 어드바이저
  const [advisors, setAdvisors] = useState(0);
  const [advisorAvgCallMin, setAdvisorAvgCallMin] = useState(3);
  const [advisorAnsweredPerDay, setAdvisorAnsweredPerDay] = useState(100);
  const [daysAdvisorPerMonth, setDaysAdvisorPerMonth] = useState(22);

  // ★ 변경: Per-Agent 입력(개/인)
  const [advisorTokensMonthlyInput, setAdvisorTokensMonthlyInput] = useState(0); // 저장 키 유지

  // ★ 최초 로드 시 기본값 복원
  useEffect(() => {
  	const d = lsLoad(LS_KEYS.GENESYS, {
  	  discountRate: 0,
  	  exchangeRate: 1400,
  	  pkgPrice: { CX1: 75, CX2: 115, CX3: 155, CX4: 240 },
  	  pkgFreeToken: { CX1: 0, CX2: 0, CX3: 0, CX4: 30 },
  	  cxPackage: "CX4" as "CX1" | "CX2" | "CX3" | "CX4",
  	  sttAddOnPacks: 0,
  	  chatbotChannels: 0,
  	  chatbotConsultsPerDay: 100,
  	  chatbotSessionsPerConsult: 5,
  	  daysChatbotPerMonth: 25,
  	  callbotChannels: 0,
  	  callbotAvgCallMin: 3,
  	  callbotAnsweredPerDay: 100,
  	  daysCallbotPerMonth: 25,
  	  advisors: 0,
  	  advisorAvgCallMin: 3,
  	  advisorAnsweredPerDay: 100,
  	  daysAdvisorPerMonth: 22,
  	  advisorTokensMonthlyInput: 0, // per-agent로 해석
  	});
  	setDiscountRate(d.discountRate);
  	setExchangeRate(d.exchangeRate);
  	setPkgPrice(d.pkgPrice);
  	setPkgFreeToken(d.pkgFreeToken);
  	setCxPackage(d.cxPackage);
  	setSttAddOnPacks(d.sttAddOnPacks);
  	setChatbotChannels(d.chatbotChannels);
  	setChatbotConsultsPerDay(d.chatbotConsultsPerDay);
  	setChatbotSessionsPerConsult(d.chatbotSessionsPerConsult);
  	setDaysChatbotPerMonth(d.daysChatbotPerMonth);
  	setCallbotChannels(d.callbotChannels);
  	setCallbotAvgCallMin(d.callbotAvgCallMin);
  	setCallbotAnsweredPerDay(d.callbotAnsweredPerDay);
  	setDaysCallbotPerMonth(d.daysCallbotPerMonth);
  	setAdvisors(d.advisors);
  	setAdvisorAvgCallMin(d.advisorAvgCallMin);
  	setAdvisorAnsweredPerDay(d.advisorAnsweredPerDay);
  	setDaysAdvisorPerMonth(d.daysAdvisorPerMonth);
  	setAdvisorTokensMonthlyInput(d.advisorTokensMonthlyInput);
  }, []);

  // 전역 → 로컬 동기화
  useEffect(() => {
  	if (props.linkedChatbotChannels !== undefined) setChatbotChannels(props.linkedChatbotChannels);
  }, [props.linkedChatbotChannels]);
  useEffect(() => {
  	if (props.linkedCallbotChannels !== undefined) setCallbotChannels(props.linkedCallbotChannels);
  }, [props.linkedCallbotChannels]);
  useEffect(() => {
  	if (props.linkedAdvisorSeats !== undefined) setAdvisors(props.linkedAdvisorSeats);
  }, [props.linkedAdvisorSeats]);

  const pricePerSeat = pkgPrice[cxPackage];
  const freeSTTPerSeat = STT_FREE_MIN_PER_SEAT[cxPackage];
  const freeTokenPerSeat = pkgFreeToken[cxPackage];

  const calc = useMemo(() => {
  	const advisorSubMonthly = advisors * pricePerSeat;

  	const chatbotSessionsMonthly =
  	  chatbotChannels * chatbotConsultsPerDay * chatbotSessionsPerConsult * daysChatbotPerMonth;
  	const chatbotMonthly = chatbotSessionsMonthly * UNIT.chatbotPerSessionUSD;

  	const callbotMinutesMonthly =
  	  callbotChannels * callbotAnsweredPerDay * callbotAvgCallMin * daysCallbotPerMonth;
  	const callbotMonthly = callbotMinutesMonthly * UNIT.callbotPerMinuteUSD;

  	const advisorSTTMinutesMonthly =
  	  advisors * advisorAnsweredPerDay * advisorAvgCallMin * daysAdvisorPerMonth;
  	const freeSTTMinutesMonthly =
  	  advisors * freeSTTPerSeat + sttAddOnPacks * ADDON_STT_MIN_PER_PACK;
  	const sttBillableMinutes = Math.max(0, advisorSTTMinutesMonthly - freeSTTMinutesMonthly);
  	const sttMonthly = sttBillableMinutes * UNIT.advisorSTTPerMinuteUSD;

  	// ★ 변경: 총 사용 토큰 = per-agent 입력 × 상담사 수
  	const usedTokensMonthly = Math.max(0, advisors * advisorTokensMonthlyInput);

  	const freeTokensMonthly = advisors * freeTokenPerSeat;
  	const tokenBillable = Math.max(0, usedTokensMonthly - freeTokensMonthly);
  	const tokenMonthly = tokenBillable * UNIT.advisorTokenPerEachUSD;

  	const unusedFreeTokens = Math.max(0, freeTokensMonthly - usedTokensMonthly);
  	const unusedTokenCreditUSD = unusedFreeTokens * UNIT.advisorTokenPerEachUSD;

  	const advisorUsageMonthly = sttMonthly + tokenMonthly;
  	const preCreditTotal =
  	  advisorSubMonthly + chatbotMonthly + callbotMonthly + advisorUsageMonthly;
  	const preDiscountTotal = Math.max(0, preCreditTotal - unusedTokenCreditUSD);

  	const discount = Math.max(0, Math.min(100, discountRate));
  	const grandTotalMonthly = Math.max(0, preDiscountTotal * (1 - discount / 100));

  	// 구독료 제외 합계
  	const preCreditNoSub = chatbotMonthly + callbotMonthly + advisorUsageMonthly;
  	const preDiscountNoSub = Math.max(0, preCreditNoSub - unusedTokenCreditUSD);
  	const grandTotalNoSubMonthly = Math.max(0, preDiscountNoSub * (1 - discount / 100));

  	return {
  	  advisorSubMonthly,
  	  chatbotMonthly,
  	  callbotMonthly,
  	  advisorUsageMonthly,
  	  freeTokensMonthly,
  	  unusedFreeTokens,
  	  unusedTokenCreditUSD,
  	  preDiscountTotal,
  	  grandTotalMonthly,
  	  grandTotalNoSubMonthly,
  	  usedTokensMonthly, // 참고 표시용
  	};
  }, [
  	advisors,
  	pricePerSeat,
  	chatbotChannels,
  	chatbotConsultsPerDay,
  	chatbotSessionsPerConsult,
  	daysChatbotPerMonth,
  	callbotChannels,
  	callbotAvgCallMin,
  	callbotAnsweredPerDay,
  	daysCallbotPerMonth,
  	advisorAvgCallMin,
  	advisorAnsweredPerDay,
  	daysAdvisorPerMonth,
  	freeSTTPerSeat,
  	sttAddOnPacks,
  	freeTokenPerSeat,
  	advisorTokensMonthlyInput, // per-agent
  	discountRate,
  ]);

  // 상단 합계(원) 업데이트
  useEffect(() => {
  	props.onTotalKRWChange?.(
  	  Math.round(calc.grandTotalMonthly * exchangeRate),
  	  Math.round(calc.grandTotalNoSubMonthly * exchangeRate)
  	);
  }, [calc.grandTotalMonthly, calc.grandTotalNoSubMonthly, exchangeRate, props]);

  // ★ 저장 버튼 핸들러 (키는 유지)
  const saveDefaults = () => {
  	lsSave(LS_KEYS.GENESYS, {
  	  discountRate,
  	  exchangeRate,
  	  pkgPrice,
  	  pkgFreeToken,
  	  cxPackage,
  	  sttAddOnPacks,
  	  chatbotChannels,
  	  chatbotConsultsPerDay,
  	  chatbotSessionsPerConsult,
  	  daysChatbotPerMonth,
  	  callbotChannels,
  	  callbotAvgCallMin,
  	  callbotAnsweredPerDay,
  	  daysCallbotPerMonth,
  	  advisors,
  	  advisorAvgCallMin,
  	  advisorAnsweredPerDay,
  	  daysAdvisorPerMonth,
  	  advisorTokensMonthlyInput, // per-agent
  	});
  	alert("Genesys 기본값을 저장했어요.");
  };

  return (
  	<>
  	  {/* 타이틀 + 링크 + 저장 */}
  	  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
  	 	<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
  	 	  <h1 style={{ ...title(), marginBottom: 0 }}>Genesys CCaaS 요금 계산기</h1>
  	 	  <HelpTip title="관련 자료">
  	 	 	<div style={{ display: "grid", gap: 6, fontSize: 13 }}>
  	 	 	  <a
  	 	 	 	href="https://help.mypurecloud.com/articles/genesys-cloud-tokens-based-pricing-model/"
  	 	 	 	target="_blank"
  	 	 	 	rel="noreferrer noopener"
  	 	 	 	style={link()}
    	 	 	  >
  	 	 	 	Genesys Cloud Tokens-based Pricing Model
  	 	 	  </a>
  	 	 	  <a
  	 	 	 	href="https://www.genesys.com/pricing"
  	 	 	 	target="_blank"
  	 	 	 	rel="noreferrer noopener"
  	 	 	 	style={link()}
    	 	 	  >
  	 	 	 	Genesys Pricing
  	 	 	  </a>
  	 	 	  <div style={{ color: "#64748b", marginTop: 4 }}>팝오버 밖을 클릭하면 닫혀요.</div>
  	 	 	</div>
  	 	  </HelpTip>
  	 	</div>
  	 	<button type="button" onClick={saveDefaults} style={saveBtn()}>저장</button>
  	  </div>

  	  {/* 최상단: 할인/환율 */}
  	  <Field label="할인율(%)">
  	 	<NumberBox value={discountRate} onChange={setDiscountRate} allowFloat />
  	  </Field>
  	  <Field label="환율 (USD→KRW)">
  	 	<NumberBox value={exchangeRate} onChange={setExchangeRate} allowFloat />
  	  </Field>

  	  {/* 패키지 가격/무료토큰 설정 */}
  	  <div
  	 	style={{
  	 	  display: "flex",
  	 	  alignItems: "flex-start",
  	 	  justifyContent: "space-between",
  	 	  gap: 12,
  	 	  flexWrap: "wrap",
  	 	}}
  	  >
  	 	<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  	 	  <h2 style={{ ...subtitle(), marginTop: 18, marginBottom: 0 }}>CX 패키지 가격 설정</h2>
  	 	  <HelpTip title="무료 제공 안내" placement="right">
  	 	 	<div style={{ fontSize: 13, lineHeight: 1.6 }}>
  	 	 	  <div style={{ fontWeight: 700, marginBottom: 4 }}>무료 제공 토큰</div>
  	 	 	  <div>• CX1/CX2/CX3 <b>0개</b></div>
  	 	 	  <div>• CX4 <b>30개</b></div>
  	 	 	  <div style={{ height: 8 }} />
  	 	 	  <div style={{ fontWeight: 700, marginBottom: 4 }}>무료 제공 STT</div>
  	 	 	  <div>• CX1/CX2 <b>100분</b></div>
  	 	 	  <div>• CX3 <b>1500분</b></div>
  	 	 	  <div>• CX4 <b>3000분</b></div>
  	 	 	  <div>• ADD-ON <b>1400분</b></div>
  	 	 	</div>
  	 	  </HelpTip>
  	 	</div>
  	  </div>

  	  <div style={noteBox()}>
  	 	각 패키지의 <b>석당 구독료</b>와 <b>무료 토큰(개/석)</b>을 설정하면, 아래 계산에 자동 반영됩니다.
  	  </div>

  	  {(["CX1", "CX2", "CX3", "CX4"] as const).map((p) => (
  	 	<div
  	 	  key={p}
  	 	  style={{
  	 	 	display: "grid",
  	 	 	gridTemplateColumns: "64px 160px 1fr 160px 1fr",
  	 	 	gap: 10,
  	 	 	alignItems: "center",
  	 	 	marginTop: 10,
  	 	 	overflow: "visible",
  	 	  }}
  	 	>
  	 	  <span style={{ fontSize: 14, color: "#111", fontWeight: 700 }}>{p}</span>
  	 	  <span style={miniLabel()}>구독료(USD/석)</span>
  	 	  <NumberBox
  	 	 	value={pkgPrice[p]}
  	 	 	onChange={(v) => setPkgPrice((prev) => ({ ...prev, [p]: Math.max(0, v) }))}
  	 	 	allowFloat
  	 	  />
  	 	  <span style={miniLabel()}>무료 토큰(개/석)</span>
  	 	  <NumberBox
  	 	 	value={pkgFreeToken[p]}
  	 	 	onChange={(v) => setPkgFreeToken((prev) => ({ ...prev, [p]: Math.max(0, v) }))}
  	 	  />
  	 	</div>
  	  ))}

  	  <Divider />

  	  {/* 패키지 선택 + 무료토큰 결과 */}
  	  <Field label="CX 패키지">
  	 	<select value={cxPackage} onChange={(e) => setCxPackage(e.target.value as any)} style={input()}>
  	 	  <option value="CX1">CX1 ({fmtUSD0(pkgPrice.CX1)}/석 · 무료토큰 {pkgFreeToken.CX1}개/석)</option>
  	 	  <option value="CX2">CX2 ({fmtUSD0(pkgPrice.CX2)}/석 · 무료토큰 {pkgFreeToken.CX2}개/석)</option>
  	 	  <option value="CX3">CX3 ({fmtUSD0(pkgPrice.CX3)}/석 · 무료토큰 {pkgFreeToken.CX3}개/석)</option>
  	 	  <option value="CX4">CX4 ({fmtUSD0(pkgPrice.CX4)}/석 · 무료토큰 {pkgFreeToken.CX4}개/석)</option>
  	 	</select>
  	  </Field>

  	  <Field label="ADD-ON 팩(STT 1,400분/팩)">
  	 	<NumberBox value={sttAddOnPacks} onChange={setSttAddOnPacks} />
  	  </Field>
  	  <Field label="상담사 수(석)">
  	 	<NumberBox value={advisors} onChange={setAdvisors} />
  	  </Field>
  	  <Field label="무료 토큰(자동)">
  	 	<ReadonlyBox value={`${(advisors * pkgFreeToken[cxPackage]).toLocaleString()} 개`} />
  	  </Field>

  	  <Divider />

  	  {/* 챗봇 */}
  	  <h2 style={subtitle()}>챗봇</h2>
  	  <Field label="채널 수">
  	 	<NumberBox value={chatbotChannels} onChange={setChatbotChannels} />
  	  </Field>
  	  <Field label="채널당 하루 상담수">
  	 	<NumberBox value={chatbotConsultsPerDay} onChange={setChatbotConsultsPerDay} />
  	  </Field>
  	  <Field label="상담당 세션수">
  	 	<NumberBox value={chatbotSessionsPerConsult} onChange={setChatbotSessionsPerConsult} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={daysChatbotPerMonth} onChange={setDaysChatbotPerMonth} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	단가: {fmtUSD3(UNIT.chatbotPerSessionUSD)}/세션 · 산식 = 채널 × 하루 상담수 × 상담당 세션수 × 영업일 × 세션단가
  	  </div>
  	  <div style={sectionTotal()}>
  	 	챗봇 월 비용: <b>{fmtUSD0(calc.chatbotMonthly)} ({fmtKRW(calc.chatbotMonthly, exchangeRate)})</b>
  	  </div>

  	  <Divider />

  	  {/* 콜봇 */}
  	  <h2 style={subtitle()}>콜봇</h2>
  	  <Field label="채널 수">
  	 	<NumberBox value={callbotChannels} onChange={setCallbotChannels} />
  	  </Field>
  	  <Field label="채널당 평균 통화시간(분)">
  	 	<NumberBox value={callbotAvgCallMin} onChange={setCallbotAvgCallMin} allowFloat />
  	  </Field>
  	  <Field label="채널당 하루 응답 콜수">
  	 	<NumberBox value={callbotAnsweredPerDay} onChange={setCallbotAnsweredPerDay} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={daysCallbotPerMonth} onChange={setDaysCallbotPerMonth} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	단가: {fmtUSD3(UNIT.callbotPerMinuteUSD)}/분 · 산식 = 채널 × 하루 응답 × 평균 통화분 × 영업일 × 분당 단가
  	  </div>
  	  <div style={sectionTotal()}>
  	 	콜봇 월 비용: <b>{fmtUSD0(calc.callbotMonthly)} ({fmtKRW(calc.callbotMonthly, exchangeRate)})</b>
  	  </div>

  	  <Divider />

  	  {/* 어드바이저 */}
  	  <h2 style={subtitle()}>어드바이저 (STT/TTS/TA/QA/KMS 포함)</h2>
  	  <Field label="상담사당 평균 통화시간(분)">
  	 	<NumberBox value={advisorAvgCallMin} onChange={setAdvisorAvgCallMin} allowFloat />
  	  </Field>
  	  <Field label="상담사당 하루 응답 콜수">
  	 	<NumberBox value={advisorAnsweredPerDay} onChange={setAdvisorAnsweredPerDay} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={daysAdvisorPerMonth} onChange={setDaysAdvisorPerMonth} />
  	  </Field>
  	  {/* ★ 변경: per-agent 입력 */}
  	  <Field label="어드바이저 월 사용 토큰(개/인)">
  	 	<NumberBox value={advisorTokensMonthlyInput} onChange={setAdvisorTokensMonthlyInput} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	STT 단가: {fmtUSD3(UNIT.advisorSTTPerMinuteUSD)}/분 · STT 산식 = 좌석 × 하루 콜 × 평균 통화분 × 영업일 − (무료 구독 STT + 무료 ADD-ON STT)
  	 	<br />
  	 	토큰 단가: {fmtUSD3(UNIT.advisorTokenPerEachUSD)}/개 · 토큰 산식 = <b>입력(개/인) × 상담사 수</b> − 무료 토큰
  	 	<br />
  	 	<span style={{ color: "#0a58ca", fontWeight: 700 }}>
  	 	  미사용 무료 토큰 크레딧: {calc.unusedFreeTokens.toLocaleString()} 개 → {fmtUSD0(calc.unusedTokenCreditUSD)} 총합계에서 차감
  	 	</span>
  	  </div>
  	  <div style={{ ...sectionTotal(), display: "grid", gap: 6 }}>
  	 	<div>어드바이저 월 비용(STT+토큰): <b>{fmtUSD0(calc.advisorUsageMonthly)} ({fmtKRW(calc.advisorUsageMonthly, exchangeRate)})</b></div>
  	 	<div style={{ fontSize: 13, color: "#0f172a" }}>
  	 	  총 사용 토큰(계산): <b>{calc.usedTokensMonthly.toLocaleString()} 개</b> (개/인 {advisorTokensMonthlyInput.toLocaleString()} × 상담사 {advisors.toLocaleString()}석)
  	 	</div>
  	  </div>

  	  <Divider />

  	  {/* 총합 */}
  	  <div style={resultBox()}>
  	 	{/* 🔴 경고문구 */}
  	 	<div style={{ fontSize: 15, color: '#dc2626', fontWeight: 800, marginBottom: 6 }}>
  	 	  정보 제한, 정확성 X, 참고용 가격
  	 	</div>
  	 	<h2>총 합계(월, 할인 적용): {fmtUSD0(calc.grandTotalMonthly)} ({fmtKRW(calc.grandTotalMonthly, exchangeRate)})</h2>
  	 	<div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "#333" }}>
  	 	  (할인 전: {fmtUSD0(calc.preDiscountTotal)} / 할인율 {Math.max(0, Math.min(100, discountRate))}% 적용)
  	 	</div>
  	 	<div style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
  	 	  └ <b>구독료 제외 시:</b> {fmtUSD0(calc.grandTotalNoSubMonthly)} ({fmtKRW(calc.grandTotalNoSubMonthly, exchangeRate)})
  	 	</div>
  	  </div>
  	</>
  );
}

/* ============================ AWS 계산기 ============================ */
function AwsCalculator(props: {
  linkedChatbotChannels?: number;
  linkedCallbotChannels?: number;
  linkedAdvisorSeats?: number;
  linkedTaQaChannels?: number; // 👈 [수정] TA/QA prop 추가
  onTotalKRWChange?: (krw: number, krwNoAc?: number) => void;
}) {
  const [awsRate, setAwsRate] = useState(1400);
  const [discountRate, setDiscountRate] = useState(0);

  const [cbtChannels, setCbtChannels] = useState(0);
  const [cbtConsultsPerDay, setCbtConsultsPerDay] = useState(100);
  const [cbtSessionsPerConsult, setCbtSessionsPerConsult] = useState(5);
  const [cbtDays, setCbtDays] = useState(25);

  const [clbChannels, setClbChannels] = useState(0);
  const [clbConsultsPerDay, setClbConsultsPerDay] = useState(100);
  const [clbAvgMinutes, setClbAvgMinutes] = useState(3);
  const [clbDays, setClbDays] = useState(25);

  const [advChannels, setAdvChannels] = useState(0);
  const [advConsultsPerDay, setAdvConsultsPerDay] = useState(100);
  const [advAvgMinutes, setAdvAvgMinutes] = useState(3);
  const [advDays, setAdvDays] = useState(22);

  const [taqaChannels, setTaqaChannels] = useState(0);
  const [taqaConsultsPerDay, setTaqaConsultsPerDay] = useState(100);
  const [taqaAvgMinutes, setTaqaAvgMinutes] = useState(3);
  const [taqaDays, setTaqaDays] = useState(22);

  // ★ 최초 로드 시 기본값 복원
  useEffect(() => {
    const d = lsLoad(LS_KEYS.AWS, {
      awsRate: 1400,
      discountRate: 0,
      cbtChannels: 0,
      cbtConsultsPerDay: 100,
      cbtSessionsPerConsult: 5,
      cbtDays: 25,
      clbChannels: 0,
      clbConsultsPerDay: 100,
      clbAvgMinutes: 3,
      clbDays: 25,
      advChannels: 0,
      advConsultsPerDay: 100,
      advAvgMinutes: 3,
      advDays: 22,
      taqaChannels: 0,
      taqaConsultsPerDay: 100,
      taqaAvgMinutes: 3,
      taqaDays: 22,
    });
    setAwsRate(d.awsRate);
    setDiscountRate(d.discountRate);
    setCbtChannels(d.cbtChannels);
    setCbtConsultsPerDay(d.cbtConsultsPerDay);
    setCbtSessionsPerConsult(d.cbtSessionsPerConsult);
    setCbtDays(d.cbtDays);
    setClbChannels(d.clbChannels);
    setClbConsultsPerDay(d.clbConsultsPerDay);
    setClbAvgMinutes(d.clbAvgMinutes);
    setClbDays(d.clbDays);
    setAdvChannels(d.advChannels);
  	setAdvConsultsPerDay(d.advConsultsPerDay);
  	setAdvAvgMinutes(d.advAvgMinutes);
  	setAdvDays(d.advDays);
  	setTaqaChannels(d.taqaChannels);
  	setTaqaConsultsPerDay(d.taqaConsultsPerDay);
  	setTaqaAvgMinutes(d.taqaAvgMinutes);
  	setTaqaDays(d.taqaDays);
  }, []);

  // 전역 → 로컬 동기화 (기존 유지)
  useEffect(() => {
  	if (props.linkedChatbotChannels !== undefined) setCbtChannels(props.linkedChatbotChannels);
  }, [props.linkedChatbotChannels]);
  useEffect(() => {
  	if (props.linkedCallbotChannels !== undefined) setClbChannels(props.linkedCallbotChannels);
  }, [props.linkedCallbotChannels]);
  useEffect(() => {
  	if (props.linkedAdvisorSeats !== undefined) setAdvChannels(props.linkedAdvisorSeats);
  }, [props.linkedAdvisorSeats]);
  // 👈 [수정] TA/QA 연동 추가
  useEffect(() => {
  	if (props.linkedTaQaChannels !== undefined) setTaqaChannels(props.linkedTaQaChannels);
  }, [props.linkedTaQaChannels]);

  const calc = useMemo(() => {
  	// 챗봇
  	const chatbotSessionsMonthly = cbtChannels * cbtConsultsPerDay * cbtSessionsPerConsult * cbtDays;
  	const chatbotUSD = chatbotSessionsMonthly * AWS_RATE.chatbotPerSessionUSD;
  	const chatbotUSD_NoAC = chatbotSessionsMonthly * AWS_RATE.chatbotPerSessionUSD_NoAC;

  	// 콜봇
  	const callbotMinutesMonthly = clbChannels * clbConsultsPerDay * clbAvgMinutes * clbDays;
  	const callbotUSD = callbotMinutesMonthly * AWS_RATE.voicePerMinuteUSD;
  	const callbotUSD_NoAC = callbotMinutesMonthly * AWS_RATE.voicePerMinuteUSD_NoAC;

  	// 어드바이저
  	const advisorMinutesMonthly = advChannels * advConsultsPerDay * advAvgMinutes * advDays;
  	const advisorUSD = advisorMinutesMonthly * AWS_RATE.voicePerMinuteUSD;
  	const advisorUSD_NoAC = advisorMinutesMonthly * AWS_RATE.voicePerMinuteUSD_NoAC;

  	// TA/QA
  	const taqaMinutesMonthly = taqaChannels * taqaConsultsPerDay * taqaAvgMinutes * taqaDays;
  	const taqaUSD = taqaMinutesMonthly * AWS_RATE.taqaPerMinuteUSD;
  	const taqaUSD_NoAC = taqaMinutesMonthly * AWS_RATE.taqaPerMinuteUSD_NoAC;

  	const discount = Math.max(0, Math.min(100, discountRate));

  	// 👈 [수정] AC 포함 총합계
  	const preDiscountTotal = chatbotUSD + callbotUSD + advisorUSD + taqaUSD;
  	const totalUSD = Math.max(0, preDiscountTotal * (1 - discount / 100));

  	// 👈 [수정] NoAC 총합계
  	const preDiscountTotal_NoAC = chatbotUSD_NoAC + callbotUSD_NoAC + advisorUSD_NoAC + taqaUSD_NoAC;
  	// 👈 [수정] "t" 오타 제거
  	const totalUSD_NoAC = Math.max(0, preDiscountTotal_NoAC * (1 - discount / 100));

  	return {
  	  chatbotUSD,
  	  callbotUSD,
  	  advisorUSD,
  	  taqaUSD,
  	  preDiscountTotal,
  	  totalUSD,
  	  chatbotUSD_NoAC,
  	  callbotUSD_NoAC,
  	  advisorUSD_NoAC,
  	  taqaUSD_NoAC,
  	  preDiscountTotal_NoAC, // 👈 [수정]
  	  totalUSD_NoAC, 		// 👈 [수정]
  	};
  }, [
  	cbtChannels,
  	cbtConsultsPerDay,
  	cbtSessionsPerConsult,
  	cbtDays,
  	clbChannels,
  	clbConsultsPerDay,
  	clbAvgMinutes,
  	clbDays,
  	advChannels,
  	advConsultsPerDay,
  	advAvgMinutes,
  	advDays,
  	taqaChannels,
  	taqaConsultsPerDay,
  	taqaAvgMinutes,
  	taqaDays,
  	discountRate,
  ]);

  // 상단 합계(원) 업데이트
  useEffect(() => {
  	props.onTotalKRWChange?.(
  	  Math.round(calc.totalUSD * awsRate),
  	  Math.round(calc.totalUSD_NoAC * awsRate) // 👈 [수정] NoAC 값 전달
  	);
  }, [calc.totalUSD, calc.totalUSD_NoAC, awsRate, props]); // 👈 [수정] 의존성 추가

  // ★ 저장 버튼
  const saveDefaults = () => {
  	lsSave(LS_KEYS.AWS, {
  	  awsRate,
  	  discountRate,
  	  cbtChannels,
  	  cbtConsultsPerDay,
  	  cbtSessionsPerConsult,
  	  cbtDays,
  	  clbChannels,
  	  clbConsultsPerDay,
  	  clbAvgMinutes,
  	  clbDays,
  	  advChannels,
  	  advConsultsPerDay,
  	  advAvgMinutes,
  	  advDays,
  	  taqaChannels,
  	  taqaConsultsPerDay,
  	  taqaAvgMinutes,
  	  taqaDays,
  	});
  	alert("AWS 기본값을 저장했어요.");
  };

  const usd = (n: number) => fmtUSD0(n);
  const krw = (n: number) => fmtKRW(n, awsRate);

  return (
  	<>
  	  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
  	 	<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
  	 	  <h1 style={{ ...title(), marginBottom: 0 }}>
  	 	 	AWS CCaaS 요금 계산기 (all-inclusive 기준)
  	 	  </h1>
  	 	  <HelpTip title="관련 자료">
  	 	 	<div style={{ display: "grid", gap: 6, fontSize: 13 }}>
  	 	 	  <a
  	 	 	 	href="https://aws.amazon.com/ko/connect/pricing/"
  	 	 	 	target="_blank"
  	 	 	 	rel="noreferrer noopener"
  	 	 	 	style={link()}
    	 	 	  >
  	 	 	 	Amazon Connect Pricing
  	 	 	  </a>
  	 	 	  <div style={{ color: "#64748b", marginTop: 4 }}>팝오버 밖을 클릭하면 닫혀요.</div>
  	 	 	</div>
  	 	  </HelpTip>
  	 	</div>
  	 	<button type="button" onClick={saveDefaults} style={saveBtn()}>저장</button>
  	  </div>

  	  <Field label="할인율(%)">
  	 	<NumberBox value={discountRate} onChange={setDiscountRate} allowFloat />
  	  </Field>
  	  <Field label="환율 (USD→KRW)">
  	 	<NumberBox value={awsRate} onChange={setAwsRate} allowFloat />
  	  </Field>

  	  <Divider />

  	  <h2 style={subtitle()}>챗봇</h2>
  	  <Field label="채널 수">
  	 	<NumberBox value={cbtChannels} onChange={setCbtChannels} />
  	  </Field>
  	  <Field label="채널당 하루 상담수">
  	 	<NumberBox value={cbtConsultsPerDay} onChange={setCbtConsultsPerDay} />
  	  </Field>
  	  <Field label="상담당 세션수">
  	 	<NumberBox value={cbtSessionsPerConsult} onChange={setCbtSessionsPerConsult} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={cbtDays} onChange={setCbtDays} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	단가: {fmtUSD3(AWS_RATE.chatbotPerSessionUSD)} /세션 · 산식 = 채널 × 하루 상담수 × 상담당 세션수 × 영업일 × 세션단가
  	 	<br />
  	 	(Amazon connect 제외) 단가: {fmtUSD3(AWS_RATE.chatbotPerSessionUSD_NoAC)} /세션 · 산식 = 채널 × 하루 상담수 × 상담당 세션수 × 영업일 × 세션단가
  	  </div>
  	  <div style={sectionTotal()}>
  	 	챗봇 월 비용: <b>{usd(calc.chatbotUSD)} ({krw(calc.chatbotUSD)})</b>
  	 	<div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>
  	 	  (Amazon connect 제외) 챗봇 월 비용: <b>{usd(calc.chatbotUSD_NoAC)} ({krw(calc.chatbotUSD_NoAC)})</b>
  	 	</div>
  	  </div>

  	  <Divider />

  	  <h2 style={subtitle()}>콜봇</h2>
  	  <Field label="채널 수">
  	 	<NumberBox value={clbChannels} onChange={setClbChannels} />
  	  </Field>
  	  <Field label="채널당 하루 상담수">
  	 	<NumberBox value={clbConsultsPerDay} onChange={setClbConsultsPerDay} />
  	  </Field>
  	  <Field label="상담당 평균 통화시간(분)">
  	 	<NumberBox value={clbAvgMinutes} onChange={setClbAvgMinutes} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={clbDays} onChange={setClbDays} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	단가: {fmtUSD3(AWS_RATE.voicePerMinuteUSD)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
  	 	<br />
  	 	(Amazon connect 제외) 단가: {fmtUSD3(AWS_RATE.voicePerMinuteUSD_NoAC)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
  	  </div>
  	  <div style={sectionTotal()}>
  	 	콜봇 월 비용: <b>{usd(calc.callbotUSD)} ({krw(calc.callbotUSD)})</b>
  	 	<div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>
  	 	  (Amazon connect 제외) 콜봇 월 비용: <b>{usd(calc.callbotUSD_NoAC)} ({krw(calc.callbotUSD_NoAC)})</b>
  	 	</div>
  	  </div>

  	  <Divider />

  	  <h2 style={subtitle()}>어드바이저 (TA/QA/KMS 포함)</h2>
  	  <Field label="채널 수">
  	 	<NumberBox value={advChannels} onChange={setAdvChannels} />
  	  </Field>
  	  <Field label="채널당 하루 상담수">
  	 	<NumberBox value={advConsultsPerDay} onChange={setAdvConsultsPerDay} />
  	  </Field>
  	  <Field label="상담당 평균 통화시간(분)">
  	 	<NumberBox value={advAvgMinutes} onChange={setAdvAvgMinutes} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={advDays} onChange={setAdvDays} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	단가: {fmtUSD3(AWS_RATE.voicePerMinuteUSD)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
  	 	<br />
  	 	(Amazon connect 제외) 단가: {fmtUSD3(AWS_RATE.voicePerMinuteUSD_NoAC)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
  	  </div>
  	  <div style={sectionTotal()}>
  	 	어드바이저 월 비용: <b>{usd(calc.advisorUSD)} ({krw(calc.advisorUSD)})</b>
  	 	<div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>
  	 	  (Amazon connect 제외) 어드바이저 월 비용: <b>{usd(calc.advisorUSD_NoAC)} ({krw(calc.advisorUSD_NoAC)})</b>
  	 	</div>
  	  </div>

  	  <Divider />

  	  <h2 style={subtitle()}>TA/QA</h2>
  	  <Field label="채널 수">
  	 	<NumberBox value={taqaChannels} onChange={setTaqaChannels} />
  	  </Field>
  	  <Field label="채널당 하루 상담수">
  	 	<NumberBox value={taqaConsultsPerDay} onChange={setTaqaConsultsPerDay} />
  	  </Field>
  	  <Field label="상담당 평균 통화시간(분)">
  	 	<NumberBox value={taqaAvgMinutes} onChange={setTaqaAvgMinutes} />
  	  </Field>
  	  <Field label="영업일(월)">
  	 	<NumberBox value={taqaDays} onChange={setTaqaDays} />
  	  </Field>
  	  <div style={noteBox()}>
  	 	단가: {fmtUSD3(AWS_RATE.taqaPerMinuteUSD)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
  	 	<br />
  	 	(Amazon connect 제외) 단가: {fmtUSD3(AWS_RATE.taqaPerMinuteUSD_NoAC)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
  	  </div>
  	  <div style={sectionTotal()}>
  	 	TA/QA 월 비용: <b>{usd(calc.taqaUSD)} ({krw(calc.taqaUSD)})</b>
  	 	<div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>
  	 	  (Amazon connect 제외) TA/QA 월 비용: <b>{usd(calc.taqaUSD_NoAC)} ({krw(calc.taqaUSD_NoAC)})</b>
  	 	</div>
  	  </div>

  	  <Divider />

  	  {/* 👈 [수정] 총합계 박스 수정 */}
  	  <div style={resultBox()}>
  	 	<h2>총 합계(월)</h2>
  	 	<div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "#333" }}>
  	 	  (할인 전: {usd(calc.preDiscountTotal)} / 할인율 {Math.max(0, Math.min(100, discountRate))}% 적용)
  	 	</div>
  	 	<div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>= {krw(calc.totalUSD)}</div>

  	 	<h2 style={{ marginTop: 20, borderTop: "1px dashed #4cafef", paddingTop: 20 }}>
  	 	  (Amazon connect 제외) 총 합계(월)
  	 	</h2>
  	 	<div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "#333" }}>
  	 	  (할인 전: {usd(calc.preDiscountTotal_NoAC)} / 할인율 {Math.max(0, Math.min(100, discountRate))}% 적용)
  	 	</div>
  	 	<div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>= {krw(calc.totalUSD_NoAC)}</div>
  	  </div>
  	</>
  );
}

/* ============================ ECP-AI 계산기 ============================ */
function EcpAiCalculator(props: {
  linkedChatbotChannels?: number;
  linkedCallbotChannels?: number;
  linkedAdvisorSeats?: number;
  linkedTaQaChannels?: number; // 👈 [수정] TA/QA prop 추가
  onTotalKRWChange?: (krw: number) => void;
}) {
  // 수량
  const [chatbotCh, setChatbotCh] = useState(0); // ① 챗봇
  const [callbotCh, setCallbotCh] = useState(0); // ② 콜봇
  const [advisorSeat, setAdvisorSeat] = useState(0); // ③ 어드바이저
  const [taSeat, setTaSeat] = useState(0);
  const [qaSeat, setQaSeat] = useState(0);
  const [kmsSeat, setKmsSeat] = useState(0);
  const [sttCh, setSttCh] = useState(0);
  const [ttsCh, setTtsCh] = useState(0);

  // 항목별 할인률(%)
  const [discChatbot, setDiscChatbot] = useState(0);
  const [discCallbot, setDiscCallbot] = useState(0);
  const [discAdvisor, setDiscAdvisor] = useState(0);
  const [discTA, setDiscTA] = useState(0);
  const [discQA, setDiscQA] = useState(0);
  const [discKMS, setDiscKMS] = useState(0);
  const [discSTT, setDiscSTT] = useState(0);
  const [discTTS, setDiscTTS] = useState(0);

  // 전체 할인률(%) — 변경 시 각 항목 할인률 자동 반영
  const [globalDiscount, setGlobalDiscount] = useState(0);
  useEffect(() => {
  	const d = clampPct(globalDiscount);
  	setDiscCallbot(d);
  	setDiscChatbot(d);
  	setDiscAdvisor(d);
  	setDiscTA(d);
  	setDiscQA(d);
  	setDiscKMS(d);
  	setDiscSTT(d);
  	setDiscTTS(d);
  }, [globalDiscount]);

  // 마진율(%) — 기본값 40
  const [marginPct, setMarginPct] = useState(40);

  // ★ 최초 로드 시 기본값 복원
  useEffect(() => {
  	const d = lsLoad(LS_KEYS.ECP, {
  	  chatbotCh: 0,
  	  callbotCh: 0,
  	  advisorSeat: 0,
  	  taSeat: 0,
  	  qaSeat: 0,
  	  kmsSeat: 0,
  	  sttCh: 0,
  	  ttsCh: 0,
  	  discChatbot: 0,
  	  discCallbot: 0,
  	  discAdvisor: 0,
  	  discTA: 0,
  	  discQA: 0,
  	  discKMS: 0,
  	  discSTT: 0,
  	  discTTS: 0,
  	  globalDiscount: 0,
  	  marginPct: 40,
  	});
  	setChatbotCh(d.chatbotCh);
  	setCallbotCh(d.callbotCh);
  	setAdvisorSeat(d.advisorSeat);
  	setTaSeat(d.taSeat);
  	setQaSeat(d.qaSeat);
  	setKmsSeat(d.kmsSeat);
  	setSttCh(d.sttCh);
  	setTtsCh(d.ttsCh);
  	setDiscChatbot(d.discChatbot);
  	setDiscCallbot(d.discCallbot);
  	setDiscAdvisor(d.discAdvisor);
  	setDiscTA(d.discTA);
  	setDiscQA(d.discQA);
  	setDiscKMS(d.discKMS);
  	setDiscSTT(d.discSTT);
  	setDiscTTS(d.discTTS);
  	setGlobalDiscount(d.globalDiscount);
  	setMarginPct(d.marginPct);
  }, []);

  // 전역 → 로컬 동기화
  useEffect(() => {
  	if (props.linkedChatbotChannels !== undefined) setChatbotCh(props.linkedChatbotChannels);
  }, [props.linkedChatbotChannels]);
  useEffect(() => {
  	if (props.linkedCallbotChannels !== undefined) setCallbotCh(props.linkedCallbotChannels);
  }, [props.linkedCallbotChannels]);
  // 👈 [수정] 어드바이저/KMS만 연동
  useEffect(() => {
  	if (props.linkedAdvisorSeats !== undefined) {
  	  const v = props.linkedAdvisorSeats;
  	  setAdvisorSeat(v);
  	  setKmsSeat(v);
  	}
  }, [props.linkedAdvisorSeats]);
  // 👈 [수정] TA/QA 연동 추가
  useEffect(() => {
  	if (props.linkedTaQaChannels !== undefined) {
  	  const v = props.linkedTaQaChannels;
  	  setQaSeat(v);
  	  setTaSeat(v);
  	}
  }, [props.linkedTaQaChannels]);


  // 수량별 자동 할인 (챗봇/어드바이저/QA/TA/KMS만 적용)
  const qtyTierDiscount = (q: number) => {
  	if (!Number.isFinite(q) || q < 50) return 0;
  	if (q < 200) return 5;
  	if (q < 350) return 10;
  	if (q < 500) return 15;
  	return 15;
  };
  useEffect(() => setDiscChatbot(qtyTierDiscount(chatbotCh)), [chatbotCh]);
  useEffect(() => setDiscAdvisor(qtyTierDiscount(advisorSeat)), [advisorSeat]);
  // 👈 [수정] "s" 오타 제거
  useEffect(() => setDiscQA(qtyTierDiscount(qaSeat)), [qaSeat]);
  useEffect(() => setDiscTA(qtyTierDiscount(taSeat)), [taSeat]);
  useEffect(() => setDiscKMS(qtyTierDiscount(kmsSeat)), [kmsSeat]);
  // 콜봇/STT/TTS는 자동 할인 미적용

  const calc = useMemo(() => {
  	const price = (qty: number, unit: number, dPct: number) =>
  	  qty * unit * (1 - clampPct(dPct) / 100);

  	const chatbot = price(chatbotCh, ECP_UNIT_KRW.chatbotPerChannel, discChatbot);
  	const callbot = price(callbotCh, ECP_UNIT_KRW.callbotPerChannel, discCallbot);
  	const advisor = price(advisorSeat, ECP_UNIT_KRW.advisorPerSeat, discAdvisor);
  	const ta = price(taSeat, ECP_UNIT_KRW.taPerSeat, discTA);
  	const qa = price(qaSeat, ECP_UNIT_KRW.qaPerSeat, discQA);
  	const kms = price(kmsSeat, ECP_UNIT_KRW.kmsPerSeat, discKMS);
  	const stt = price(sttCh, ECP_UNIT_KRW.sttPerChannel, discSTT);
  	const tts = price(ttsCh, ECP_UNIT_KRW.ttsPerChannel, discTTS);

  	const discountedSubtotal = Math.max(
  	  0,
  	  callbot + chatbot + advisor + ta + qa + kms + stt + tts
  	);

  	const m = Math.max(0, marginPct);
  	const marginAmount = Math.round(discountedSubtotal * (m / 100));
  	const grandTotal = discountedSubtotal + marginAmount;

  	return {
  	  items: { callbot, chatbot, advisor, ta, qa, kms, stt, tts },
  	  discountedSubtotal,
  	  marginAmount,
  	  grandTotal,
  	};
  }, [
  	callbotCh,
  	chatbotCh,
  	advisorSeat,
  	taSeat,
  	qaSeat,
  	kmsSeat,
  	sttCh,
  	ttsCh,
  	discCallbot,
  	discChatbot,
  	discAdvisor,
  	discTA,
  	discQA,
  	discKMS,
  	discSTT,
  	discTTS,
  	marginPct,
  ]);

  // 상단 합계(원) 업데이트
  useEffect(() => {
  	props.onTotalKRWChange?.(calc.grandTotal);
  }, [calc.grandTotal, props]);

  // ★ 저장 버튼
  const saveDefaults = () => {
  	lsSave(LS_KEYS.ECP, {
  	  chatbotCh,
  	  callbotCh,
  	  advisorSeat,
  	  taSeat,
  	  qaSeat,
  	  kmsSeat,
  	  sttCh,
  	  ttsCh,
  	  discChatbot,
  	  discCallbot,
  	  discAdvisor,
  	  discTA,
  	  discQA,
  	  discKMS,
  	  discSTT,
  	  discTTS,
  	  globalDiscount,
  	  marginPct,
  	});
  	alert("ECP-AI 기본값을 저장했어요.");
  };

  return (
  	<>
  	  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
  	 	<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
  	 	  <h1 style={{ ...title(), marginBottom: 0 }}>ECP-AI 단가 계산기</h1>
  	 	  <HelpTip title="단가 (월)">
  	 	 	<div style={{ fontSize: 13, lineHeight: 1.6 }}>
  	 	 	  <div>콜봇: {fmtKRWwon(ECP_UNIT_KRW.callbotPerChannel)}/채널</div>
  	 	 	  <div>챗봇: {fmtKRWwon(ECP_UNIT_KRW.chatbotPerChannel)}/채널</div>
  	 	 	  <div>어드바이저: {fmtKRWwon(ECP_UNIT_KRW.advisorPerSeat)}/석</div>
  	 	 	  <div>TA/QA/KMS: {fmtKRWwon(25_000)}/석</div>
  	 	 	  <div>STT: {fmtKRWwon(ECP_UNIT_KRW.sttPerChannel)}/채널</div>
  	 	 	  <div>TTS: {fmtKRWwon(ECP_UNIT_KRW.ttsPerChannel)}/채널</div>
  	 	 	</div>
  	 	  </HelpTip>
  	 	</div>
  	 	<button type="button" onClick={saveDefaults} style={saveBtn()}>저장</button>
  	  </div>

  	  {/* 전체 할인률 */}
  	  <Field label="전체 할인률(%)">
  	 	<NumberBox value={globalDiscount} onChange={setGlobalDiscount} allowFloat />
  	  </Field>
  	  <div style={noteBox()}>
  	 	전체 할인률을 입력하면 <b>아래 모든 항목의 할인률이 동일하게 설정</b>됩니다. (개별 항목에서 다시 수정 가능)
  	  </div>

  	  <Divider />

  	  {/* 수량 / 항목별 할인률 */}
  	  <h2 style={subtitle()}>수량 / 항목별 할인률</h2>

  	  <TwoCols label="챗봇 채널 수" rightLabel="챗봇 할인률(%)">
  	 	<NumberBox value={chatbotCh} onChange={setChatbotCh} />
  	 	<NumberBox value={discChatbot} onChange={setDiscChatbot} allowFloat />
  	  </TwoCols>

  	  <TwoCols label="콜봇 채널 수" rightLabel="콜봇 할인률(%)">
  	 	<NumberBox value={callbotCh} onChange={setCallbotCh} />
  	 	<NumberBox value={discCallbot} onChange={setDiscCallbot} allowFloat />
  	  </TwoCols>

  	  <TwoCols label="어드바이저 좌석 수" rightLabel="어드바이저 할인률(%)">
  	 	<NumberBox value={advisorSeat} onChange={setAdvisorSeat} />
  	 	<NumberBox value={discAdvisor} onChange={setDiscAdvisor} allowFloat />
  	  </TwoCols>

  	  {/* 👈 [수정] "S" 문자 제거 */}
  	  <TwoCols label="QA 좌석 수" rightLabel="QA 할인률(%)">
  	 	<NumberBox value={qaSeat} onChange={setQaSeat} />
  	 	<NumberBox value={discQA} onChange={setDiscQA} allowFloat />
  	  </TwoCols>

  	  <TwoCols label="TA 좌석 수" rightLabel="TA 할인률(%)">
  	 	<NumberBox value={taSeat} onChange={setTaSeat} />
  	 	<NumberBox value={discTA} onChange={setDiscTA} allowFloat />
  	  </TwoCols>

  	  <TwoCols label="KMS 좌석 수" rightLabel="KMS 할인률(%)">
  	 	<NumberBox value={kmsSeat} onChange={setKmsSeat} />
  	 	<NumberBox value={discKMS} onChange={setDiscKMS} allowFloat />
  	  </TwoCols>

  	  <TwoCols label="STT 채널 수" rightLabel="STT 할인률(%)">
  	 	<NumberBox value={sttCh} onChange={setSttCh} />
  	 	<NumberBox value={discSTT} onChange={setDiscSTT} allowFloat />
  	  </TwoCols>

  	  <TwoCols label="TTS 채널 수" rightLabel="TTS 할인률(%)">
  	 	<NumberBox value={ttsCh} onChange={setTtsCh} />
  	 	<NumberBox value={discTTS} onChange={setDiscTTS} allowFloat />
  	  </TwoCols>

  	  <Divider />

  	  {/* 마진율 */}
  	  <Field label="마진율(%)">
  	 	<NumberBox value={marginPct} onChange={setMarginPct} allowFloat />
  	  </Field>
  	  <div style={noteBox()}>
  	 	마진은 <b>전체 할인 적용 후</b> 금액에 <b>추가</b>됩니다. (총액 × 마진율)
  	  </div>

  	  <Divider />

  	  {/* 요약 */}
  	  <h2 style={subtitle()}>요약</h2>
  	  <Line label={`콜봇 (단가 ${fmtKRWwon(ECP_UNIT_KRW.callbotPerChannel)} /채널 · 할인 ${clampPct(discCallbot)}%)`} value={calc.items.callbot} />
  	  <Line label={`챗봇 (단가 ${fmtKRWwon(ECP_UNIT_KRW.chatbotPerChannel)} /채널 · 할인 ${clampPct(discChatbot)}%)`} value={calc.items.chatbot} />
  	  <Line label={`어드바이저 (단가 ${fmtKRWwon(ECP_UNIT_KRW.advisorPerSeat)} /석 · 할인 ${clampPct(discAdvisor)}%)`} value={calc.items.advisor} />
  	  <Line label={`TA (단가 ${fmtKRWwon(ECP_UNIT_KRW.taPerSeat)} /석 · 할인 ${clampPct(discTA)}%)`} value={calc.items.ta} />
  	  <Line label={`QA (단가 ${fmtKRWwon(ECP_UNIT_KRW.qaPerSeat)} /석 · 할인 ${clampPct(discQA)}%)`} value={calc.items.qa} />
  	  <Line label={`KMS (단가 ${fmtKRWwon(ECP_UNIT_KRW.kmsPerSeat)} /석 · 할인 ${clampPct(discKMS)}%)`} value={calc.items.kms} />
  	  <Line label={`STT (단가 ${fmtKRWwon(ECP_UNIT_KRW.sttPerChannel)} /채널 · 할인 ${clampPct(discSTT)}%)`} value={calc.items.stt} />
  	  <Line label={`TTS (단가 ${fmtKRWwon(ECP_UNIT_KRW.ttsPerChannel)} /채널 · 할인 ${clampPct(discTTS)}%)`} value={calc.items.tts} />

  	  <div style={resultBox()}>
  	 	<h2 style={{ margin: 0 }}>총 합계(월)</h2>
  	 	<div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "#333" }}>
  	 	  할인 적용 소계: {fmtKRWwon(calc.discountedSubtotal)} / 마진({Math.max(0, marginPct)}%): {fmtKRWwon(calc.marginAmount)}
  	 	</div>
  	 	<div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>= {fmtKRWwon(calc.grandTotal)}</div>
  	  </div>
  	</>
  );
}

/* ============================ 재사용 UI ============================ */
function Field(props: { label: React.ReactNode; children: React.ReactNode }) {
  const id = useUniqueId();
  return (
  	<label style={field()} htmlFor={id}>
  	  <span style={{ fontSize: 14, color: "#111", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
  	 	{props.label}
  	  </span>
  	  <div id={id}>{props.children}</div>
  	</label>
  );
}

function TwoCols(props: { label: React.ReactNode; rightLabel: React.ReactNode; children: React.ReactNode[] }) {
  const [left, right] = props.children as [React.ReactNode, React.ReactNode];
  return (
  	<div style={twoCols()}>
  	  <div style={{ display: "contents" }}>
  	 	<span style={twoColsLabel()}>{props.label}</span>
  	 	<div>{left}</div>
  	  </div>
  	  <div style={{ display: "contents" }}>
  	 	<span style={twoColsLabel()}>{props.rightLabel}</span>
  	 	<div>{right}</div>
  	  </div>
  	</div>
  );
}

function NumberBox({
  value,
  onChange,
  allowFloat = false,
  width,
}: {
  value: number;
  onChange: (v: number) => void;
  allowFloat?: boolean;
  width?: number;
}) {
  const [raw, setRaw] = useState(String(value ?? ""));
  useEffect(() => {
  	setRaw(String(value ?? ""));
  }, [value]);

  return (
  	<input
  	  type="text"
  	  inputMode={allowFloat ? "decimal" : "numeric"}
  	  value={raw}
  	  onChange={(e) => {
  	 	const v = e.target.value;
  	 	setRaw(v);
  	 	const num = Number(v);
  	 	if (!Number.isNaN(num)) onChange(Math.max(0, num));
  	  }}
  	  onBlur={() => {
  	 	const num = Number(raw);
  	 	const fixed = Number.isNaN(num) ? 0 : Math.max(0, num);
  	 	onChange(fixed);
  	 	setRaw(String(fixed));
  	  }}
  	  style={{ ...input(), width: width ? width : "100%" }}
  	  placeholder="0"
  	/>
  );
}

function ReadonlyBox({ value }: { value: string }) {
  return (
  	<input type="text" value={value} readOnly disabled style={{ ...input(), color: "#555", background: "#f8fafc" }} />
  );
}

function Divider() {
  return <div style={dash()}>--------</div>;
}

function HelpTip({
  title,
  children,
  placement = "right",
}: {
  title?: string;
  children: React.ReactNode;
  placement?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  return (
  	<span style={{ position: "relative", display: "inline-block" }}>
  	  <button
  	 	type="button"
  	 	onClick={() => setOpen((v) => !v)}
  	 	onBlur={() => setTimeout(() => setOpen(false), 150)}
  	 	aria-label="도움말"
  	 	style={{
  	 	  width: 22,
  	 	  height: 22,
  	 	  lineHeight: "22px",
  	 	  borderRadius: "50%",
  	 	  border: "1px solid #cbd5e1",
  	 	  background: "#fff",
  	 	  color: "#0f172a",
  	 	  fontWeight: 800,
  	 	  fontSize: 12,
  	 	  textAlign: "center",
  	 	  cursor: "pointer",
  	 	  padding: 0,
  	 	}}
  	  >
  	 	?
  	  </button>
  	  {open && (
  	 	<div
  	 	  style={{
  	 	 	position: "absolute",
  	 	 	top: "50%",
  	 	 	[placement === "right" ? "left" : "right"]: 28,
  	 	 	transform: "translateY(-50%)",
  	 	 	minWidth: 260,
    	 	 	maxWidth: 320,
  	 	 	padding: 12,
  	 	 	borderRadius: 10,
  	 	 	border: "1px solid #e5e7eb",
  	 	 	background: "#ffffff",
  	 	 	boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
  	 	 	zIndex: 1000,
  	 	  } as React.CSSProperties}
  	 	>
  	 	  {title && <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>}
  	 	  {children}
  	 	</div>
  	  )}
  	</span>
  );
}

/* ============================ 유틸 & 스타일 ============================ */
function useUniqueId() {
  const [id] = useState(() => Math.random().toString(36).slice(2, 9));
  return id;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

const page = () => ({ padding: 16 });

/* 상단 2열: 좌측 입력을 조금 좁게(1.4) / 우측 합계(1) + 간격 넓힘 */
const topGrid = () => ({
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr",
  gap: 28, // ← 간격 넓힘
  alignItems: "stretch",
  maxWidth: 2100,
  margin: "0 auto 16px",
});

const grid3Col = () => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(520px, 1fr))",
  gap: 56,
  alignItems: "start",
  maxWidth: 2100,
  margin: "0 auto",
});

const container = () => ({
  width: "100%",
  padding: 20,
  fontFamily: "system-ui, sans-serif",
  color: "#111",
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
});

const title = () => ({ fontSize: 28, fontWeight: 800, marginBottom: 20 });
const subtitle = () => ({ fontSize: 20, fontWeight: 700, marginTop: 30, marginBottom: 10 });

const field = () => ({
  display: "grid",
  gridTemplateColumns: "240px 1fr",
  alignItems: "center",
  gap: 10,
  marginTop: 10,
});

const twoCols = () => ({
  display: "grid",
  gridTemplateColumns: "200px 1fr 200px 1fr",
  alignItems: "center",
  gap: 10,
  marginTop: 10,
});

const twoColsLabel = () => ({ fontSize: 14, color: "#111", fontWeight: 600 });

const input = () => ({
  width: "100%",
  padding: "12px 14px",
  height: 48,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  fontSize: 18,
  fontWeight: 600,
  color: "#111",
  background: "#fff",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
  textAlign: "right" as const,
  boxSizing: "border-box" as const,
  caretColor: "#111",
  outlineColor: "#111",
});

const noteBox = () => ({
  marginTop: 8,
  padding: 10,
  borderRadius: 10,
  background: "#f6f8fa",
  border: "1px solid #e5e7eb",
  fontSize: 14,
  color: "#333",
  lineHeight: 1.6,
});

const sectionTotal = () => ({
  marginTop: 8,
  padding: 10,
  borderRadius: 10,
  background: "#eef6ff",
  border: "1px solid #cfe7ff",
  fontSize: 16,
  fontWeight: 700,
});

const resultBox = () => ({
  marginTop: 24,
  padding: 20,
  border: "2px solid #4cafef",
  borderRadius: 12,
  background: "#f0f9ff",
  fontSize: 18,
  fontWeight: 700,
});

const dash = () => ({
  margin: "18px 0 8px",
  textAlign: "center" as const,
  color: "#94a3b8",
  fontWeight: 800,
  letterSpacing: 2,
});

const miniLabel = () => ({
  fontSize: 13,
  color: "#333",
  fontWeight: 600,
});

const link = (): React.CSSProperties => ({
  color: "#0a58ca",
  textDecoration: "underline",
  fontWeight: 600,
  wordBreak: "break-all",
});

const sheetBar = (): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  margin: "0 auto 16px",
  maxWidth: 2100,
  overflow: "hidden",
});

const sheetLink = (): React.CSSProperties => ({
  ...link(),
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "inline-block",
  maxWidth: "100%",
});

/* 상단 합계 카드 */
function QuickTotal({
  label,
  valueKRW,
  subLabel,
  subValueKRW,
  warn, // 🔴 경고문구 한 줄(옵션)
}: {
  label: string;
  valueKRW: number;
  subLabel?: string;
  subValueKRW?: number;
  warn?: string; // 🔴 옵션
}) {
  return (
  	<div
  	  style={{
  	 	marginTop: 8,
  	 	padding: 14,
  	 	borderRadius: 12,
  	 	border: "1px solid #e5e7eb",
  	 	background: "#f8fafc",
  	 	display: "grid",
  	 	gridTemplateColumns: "1fr auto",
  	 	alignItems: "center",
  	 	gap: 8,
  	  }}
  >
  	<div>
  	  {/* 박스 내부 상단 경고문구 */}
  	  {warn && (
  	 	<div style={{ fontSize: 14, color: "#dc2626", fontWeight: 800, marginBottom: 4 }}>
  	 	  {warn}
  	 	</div>
  	  )}

  	  <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{label}</span>

  	  {typeof subValueKRW === "number" && subLabel && (
  	 	<div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>
  	 	  └ <span>{subLabel}:</span> <span>{fmtKRWwon(subValueKRW)}</span>
  	 	</div>
  	  )}
  	</div>

  	<span style={{ fontSize: 20, fontWeight: 900 }}>{fmtKRWwon(valueKRW)}</span>
  </div>
  );
}

function Line({ label, value }: { label: React.ReactNode; value: number }) {
  return (
  	<div
  	  style={{
  	 	display: "flex",
  	 	justifyContent: "space-between",
  	 	alignItems: "center",
  	 	padding: "10px 12px",
  	 	border: "1px solid #e5e7eb",
  	 	borderRadius: 10,
  	 	background: "#f9fafb",
  	 	marginTop: 6,
  	  }}
  	>
  	  <span style={{ color: "#111" }}>{label}</span>
  	  <b>{fmtKRWwon(value)}</b>
  	</div>
  );
}

/* ★ 저장 버튼 스타일 */
const saveBtn = (): React.CSSProperties => ({
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #0ea5e9",
  background: "#e0f2fe",
  color: "#0c4a6e",
  fontWeight: 800,
  cursor: "pointer",
});