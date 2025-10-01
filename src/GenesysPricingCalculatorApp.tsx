import React, { useMemo, useState } from "react";

/* ============================ 공통 포맷터 ============================ */
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const fmtUSD3 = (n: number) => `$${(n || 0).toFixed(3)}`;
const fmtKRW = (n: number, rate: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 })
    .format(Math.round((n || 0) * rate));

/* ============================ Genesys 상수 ============================ */
const UNIT = {
  callbotPerMinuteUSD: 0.06,      // 콜봇: $0.06/분
  chatbotPerSessionUSD: 0.02,     // 챗봇: $0.02/세션
  advisorSTTPerMinuteUSD: 0.01,   // 어드바이저 STT: $0.01/분
  advisorTokenPerEachUSD: 1,      // 어드바이저 토큰: $1/개
} as const;

const PACKAGE_PRICE: Record<"CX1" | "CX2" | "CX3" | "CX4", number> = { CX1: 75, CX2: 115, CX3: 155, CX4: 240 };
const STT_FREE_MIN_PER_SEAT: Record<"CX1" | "CX2" | "CX3" | "CX4", number> = { CX1: 100, CX2: 100, CX3: 1500, CX4: 3000 };
const TOKEN_FREE_PER_SEAT: Record<"CX1" | "CX2" | "CX3" | "CX4", number> = { CX1: 0, CX2: 0, CX3: 0, CX4: 30 };
const ADDON_STT_MIN_PER_PACK = 1400;

/* ============================ AWS 상수 ============================ */
const AWS_RATE = {
  chatbotPerSessionUSD: 0.01,  // 챗봇: $0.01/세션
  voicePerMinuteUSD: 0.038,    // 콜봇/어드바이저: $0.038/분
};

/* ============================ 메인 앱 ============================ */
export default function PricingApp() {
  return (
    <div style={page()}>
      <div style={grid2Col()}>
        <div style={container()}>
          <GenesysCalculator />
        </div>
        <div style={container()}>
          <AwsCalculator />
        </div>
      </div>
    </div>
  );
}

/* ============================ Genesys 계산기 ============================ */
function GenesysCalculator() {
  const [cxPackage, setCxPackage] = useState<"CX1" | "CX2" | "CX3" | "CX4">("CX4");
  const [exchangeRate, setExchangeRate] = useState(1370);

  // ADD-ON 팩 (플랜 공통 옵션)
  const [sttAddOnPacks, setSttAddOnPacks] = useState(0);

  // 챗봇
  const [chatbotChannels, setChatbotChannels] = useState(0);
  const [chatbotAvgSessionPerDay, setChatbotAvgSessionPerDay] = useState(0);
  const [daysChatbotPerMonth, setDaysChatbotPerMonth] = useState(22);

  // 콜봇
  const [callbotChannels, setCallbotChannels] = useState(0);
  const [callbotAvgCallMin, setCallbotAvgCallMin] = useState(0);
  const [callbotAnsweredPerDay, setCallbotAnsweredPerDay] = useState(0);
  const [daysCallbotPerMonth, setDaysCallbotPerMonth] = useState(22);

  // 어드바이저
  const [advisors, setAdvisors] = useState(100);
  const [advisorAvgCallMin, setAdvisorAvgCallMin] = useState(3);
  const [advisorAnsweredPerDay, setAdvisorAnsweredPerDay] = useState(100);
  const [daysAdvisorPerMonth, setDaysAdvisorPerMonth] = useState(22);
  const [advisorTokensMonthlyInput, setAdvisorTokensMonthlyInput] = useState(0);

  const pricePerSeat = PACKAGE_PRICE[cxPackage];
  const freeSTTPerSeat = STT_FREE_MIN_PER_SEAT[cxPackage];
  const freeTokenPerSeat = TOKEN_FREE_PER_SEAT[cxPackage];

  const calc = useMemo(() => {
    // 구독료
    const advisorSubMonthly = advisors * pricePerSeat;

    // 챗봇
    const chatbotSessionsMonthly = chatbotChannels * chatbotAvgSessionPerDay * daysChatbotPerMonth;
    const chatbotMonthly = chatbotSessionsMonthly * UNIT.chatbotPerSessionUSD;

    // 콜봇
    const callbotMinutesMonthly = callbotChannels * callbotAnsweredPerDay * callbotAvgCallMin * daysCallbotPerMonth;
    const callbotMonthly = callbotMinutesMonthly * UNIT.callbotPerMinuteUSD;

    // 어드바이저 STT + 토큰(과금)
    const advisorSTTMinutesMonthly = advisors * advisorAnsweredPerDay * advisorAvgCallMin * daysAdvisorPerMonth;
    const freeSTTMinutesMonthly = advisors * freeSTTPerSeat + sttAddOnPacks * ADDON_STT_MIN_PER_PACK;
    const sttBillableMinutes = Math.max(0, advisorSTTMinutesMonthly - freeSTTMinutesMonthly);
    const sttMonthly = sttBillableMinutes * UNIT.advisorSTTPerMinuteUSD;

    const freeTokensMonthly = advisors * freeTokenPerSeat;              // 자동 무료 토큰(개)
    const usedTokensMonthly = advisorTokensMonthlyInput;                // 입력 사용 토큰(개)
    const tokenBillable = Math.max(0, usedTokensMonthly - freeTokensMonthly);
    const tokenMonthly = tokenBillable * UNIT.advisorTokenPerEachUSD;

    // 무료 토큰 미사용분(크레딧)
    const unusedFreeTokens = Math.max(0, freeTokensMonthly - usedTokensMonthly);
    const unusedTokenCreditUSD = unusedFreeTokens * UNIT.advisorTokenPerEachUSD; // 1토큰=$1 차감

    const advisorUsageMonthly = sttMonthly + tokenMonthly;

    // 총합 = 구독 + 챗봇 + 콜봇 + (어드바이저 사용비) − 미사용 무료토큰 크레딧
    const preCreditTotal = advisorSubMonthly + chatbotMonthly + callbotMonthly + advisorUsageMonthly;
    const grandTotalMonthly = preCreditTotal - unusedTokenCreditUSD;

    return {
      chatbotMonthly,
      callbotMonthly,
      advisorUsageMonthly,
      freeTokensMonthly,
      unusedFreeTokens,
      unusedTokenCreditUSD,
      grandTotalMonthly,
    };
  }, [
    advisors, pricePerSeat,
    chatbotChannels, chatbotAvgSessionPerDay, daysChatbotPerMonth,
    callbotChannels, callbotAvgCallMin, callbotAnsweredPerDay, daysCallbotPerMonth,
    advisorAvgCallMin, advisorAnsweredPerDay, daysAdvisorPerMonth,
    freeSTTPerSeat, sttAddOnPacks, freeTokenPerSeat,
    advisorTokensMonthlyInput,
  ]);

  return (
    <>
      <h1 style={title()}>Genesys CCaaS 요금 계산기</h1>

      {/* 구독 & 기본 */}
      <Field label="CX 패키지">
        <select value={cxPackage} onChange={(e) => setCxPackage(e.target.value as any)} style={input()}>
          <option value="CX1">CX1 ({fmtUSD(PACKAGE_PRICE.CX1)}/석)</option>
          <option value="CX2">CX2 ({fmtUSD(PACKAGE_PRICE.CX2)}/석)</option>
          <option value="CX3">CX3 ({fmtUSD(PACKAGE_PRICE.CX3)}/석)</option>
          <option value="CX4">CX4 ({fmtUSD(PACKAGE_PRICE.CX4)}/석 + 무료 토큰 30개/석)</option>
        </select>
      </Field>

      {/* ADD-ON 팩: 패키지 바로 아래 */}
      <Field label="ADD-ON 팩">
        <NumberBox value={sttAddOnPacks} onChange={setSttAddOnPacks} />
      </Field>

      <Field label="상담사 수(석)"><NumberBox value={advisors} onChange={setAdvisors} /></Field>

      {/* 무료 토큰(자동 계산 표시) */}
      <Field label="무료 토큰(자동)">
        <ReadonlyBox value={`${calc.freeTokensMonthly.toLocaleString()} 개`} />
      </Field>

      <Field label="환율 (USD→KRW)"><NumberBox value={exchangeRate} onChange={setExchangeRate} allowFloat /></Field>

      <Divider />

      {/* ── 챗봇 ── */}
      <h2 style={subtitle()}>챗봇</h2>
      <Field label="채널 수"><NumberBox value={chatbotChannels} onChange={setChatbotChannels} /></Field>
      <Field label="채널당 하루 평균 세션"><NumberBox value={chatbotAvgSessionPerDay} onChange={setChatbotAvgSessionPerDay} /></Field>
      {/* 1) 영업일 */}
      <Field label="영업일(월)"><NumberBox value={daysChatbotPerMonth} onChange={setDaysChatbotPerMonth} /></Field>
      {/* 2) 단가/산식 */}
      <div style={noteBox()}>
        단가: {fmtUSD(UNIT.chatbotPerSessionUSD)}/세션 · 산식 = 채널 × 하루 세션 × 영업일 × 세션단가
      </div>
      {/* 3) 월 비용 */}
      <div style={sectionTotal()}>챗봇 월 비용: <b>{fmtUSD(calc.chatbotMonthly)}</b></div>

      <Divider />

      {/* ── 콜봇 ── */}
      <h2 style={subtitle()}>콜봇</h2>
      <Field label="채널 수"><NumberBox value={callbotChannels} onChange={setCallbotChannels} /></Field>
      <Field label="채널당 평균 통화시간(분)"><NumberBox value={callbotAvgCallMin} onChange={setCallbotAvgCallMin} allowFloat /></Field>
      <Field label="채널당 하루 응답 콜수"><NumberBox value={callbotAnsweredPerDay} onChange={setCallbotAnsweredPerDay} /></Field>
      {/* 1) 영업일 */}
      <Field label="영업일(월)"><NumberBox value={daysCallbotPerMonth} onChange={setDaysCallbotPerMonth} /></Field>
      {/* 2) 단가/산식 */}
      <div style={noteBox()}>
        단가: {fmtUSD(UNIT.callbotPerMinuteUSD)}/분 · 산식 = 채널 × 하루 응답 × 평균 통화분 × 영업일 × 분당 단가
      </div>
      {/* 3) 월 비용 */}
      <div style={sectionTotal()}>콜봇 월 비용: <b>{fmtUSD(calc.callbotMonthly)}</b></div>

      <Divider />

      {/* ── 어드바이저 ── */}
      <h2 style={subtitle()}>어드바이저</h2>
      <Field label="상담사당 평균 통화시간(분)"><NumberBox value={advisorAvgCallMin} onChange={setAdvisorAvgCallMin} allowFloat /></Field>
      <Field label="상담사당 하루 응답 콜수"><NumberBox value={advisorAnsweredPerDay} onChange={setAdvisorAnsweredPerDay} /></Field>
      {/* 1) 영업일 */}
      <Field label="영업일(월)"><NumberBox value={daysAdvisorPerMonth} onChange={setDaysAdvisorPerMonth} /></Field>
      {/* (위치 변경된 토큰 입력은 그대로 유지) */}
      <Field label="어드바이저 월 사용 토큰(개)"><NumberBox value={advisorTokensMonthlyInput} onChange={setAdvisorTokensMonthlyInput} /></Field>
      {/* 2) 단가/산식 */}
      <div style={noteBox()}>
        STT 단가: {fmtUSD(UNIT.advisorSTTPerMinuteUSD)}/분 · STT 산식 = 좌석 × 하루 콜 × 평균 통화분 × 영업일 − (무료 STT + ADD-ON)<br/>
        토큰 단가: {fmtUSD(UNIT.advisorTokenPerEachUSD)}/개 · 토큰 산식 = (입력 토큰 − 무료 토큰)⁺<br/>
        <span style={{ color: "#0a58ca", fontWeight: 700 }}>
          미사용 무료 토큰 크레딧: {calc.unusedFreeTokens.toLocaleString()} 개 → {fmtUSD(calc.unusedTokenCreditUSD)} 총합계에서 차감
        </span>
      </div>
      {/* 3) 월 비용 */}
      <div style={sectionTotal()}>어드바이저 월 비용(STT+토큰): <b>{fmtUSD(calc.advisorUsageMonthly)}</b></div>

      <Divider />

      {/* 총합 (합계만) */}
      <div style={resultBox()}>
        <h2>총 합계(월): {fmtUSD(calc.grandTotalMonthly)} ({fmtKRW(calc.grandTotalMonthly, exchangeRate)})</h2>
      </div>
    </>
  );
}

/* ============================ AWS 계산기 (변경 없음) ============================ */
function AwsCalculator() {
  const [awsRate, setAwsRate] = useState(1380);

  // 챗봇
  const [cbtChannels, setCbtChannels] = useState(0);
  const [cbtConsultsPerDay, setCbtConsultsPerDay] = useState(0);
  const [cbtSessionsPerConsult, setCbtSessionsPerConsult] = useState(0);
  const [cbtDays, setCbtDays] = useState(30);

  // 콜봇
  const [clbChannels, setClbChannels] = useState(0);
  const [clbConsultsPerDay, setClbConsultsPerDay] = useState(0);
  const [clbAvgMinutes, setClbAvgMinutes] = useState(0);
  const [clbDays, setClbDays] = useState(30);

  // 어드바이저
  const [advChannels, setAdvChannels] = useState(0);
  const [advConsultsPerDay, setAdvConsultsPerDay] = useState(0);
  const [advAvgMinutes, setAdvAvgMinutes] = useState(0);
  const [advDays, setAdvDays] = useState(22);

  const calc = useMemo(() => {
    const chatbotSessionsMonthly =
      cbtChannels * cbtConsultsPerDay * cbtSessionsPerConsult * cbtDays;
    const chatbotUSD = chatbotSessionsMonthly * AWS_RATE.chatbotPerSessionUSD;

    const callbotMinutesMonthly =
      clbChannels * clbConsultsPerDay * clbAvgMinutes * clbDays;
    const callbotUSD = callbotMinutesMonthly * AWS_RATE.voicePerMinuteUSD;

    const advisorMinutesMonthly =
      advChannels * advConsultsPerDay * advAvgMinutes * advDays;
    const advisorUSD = advisorMinutesMonthly * AWS_RATE.voicePerMinuteUSD;

    const totalUSD = chatbotUSD + callbotUSD + advisorUSD;
    return { chatbotUSD, callbotUSD, advisorUSD, totalUSD };
  }, [
    cbtChannels, cbtConsultsPerDay, cbtSessionsPerConsult, cbtDays,
    clbChannels, clbConsultsPerDay, clbAvgMinutes, clbDays,
    advChannels, advConsultsPerDay, advAvgMinutes, advDays,
  ]);

  const usd = (n: number) => fmtUSD3(n);
  const krw = (n: number) => fmtKRW(n, awsRate);

  return (
    <>
      <h1 style={title()}>AWS CCaaS 요금 계산기 (all-inclusive 기준)</h1>
      <Field label="환율 (USD→KRW)"><NumberBox value={awsRate} onChange={setAwsRate} allowFloat /></Field>

      <Divider />

      {/* 챗봇 */}
      <h2 style={subtitle()}>챗봇</h2>
      <Field label="채널 수"><NumberBox value={cbtChannels} onChange={setCbtChannels} /></Field>
      <Field label="채널당 하루 상담수"><NumberBox value={cbtConsultsPerDay} onChange={setCbtConsultsPerDay} /></Field>
      <Field label="상담당 세션수"><NumberBox value={cbtSessionsPerConsult} onChange={setCbtSessionsPerConsult} /></Field>
      <Field label="영업일(월)"><NumberBox value={cbtDays} onChange={setCbtDays} /></Field>
      <div style={noteBox()}>
        단가: {fmtUSD(AWS_RATE.chatbotPerSessionUSD)}/세션 · 산식 = 채널 × 하루 상담수 × 상담당 세션수 × 영업일 × 세션단가
      </div>
      <div style={sectionTotal()}>챗봇 월 비용: <b>{usd(calc.chatbotUSD)}</b></div>

      <Divider />

      {/* 콜봇 */}
      <h2 style={subtitle()}>콜봇</h2>
      <Field label="채널 수"><NumberBox value={clbChannels} onChange={setClbChannels} /></Field>
      <Field label="채널당 하루 상담수"><NumberBox value={clbConsultsPerDay} onChange={setClbConsultsPerDay} /></Field>
      <Field label="상담당 평균 통화시간(분)"><NumberBox value={clbAvgMinutes} onChange={setClbAvgMinutes} /></Field>
      <Field label="영업일(월)"><NumberBox value={clbDays} onChange={setClbDays} /></Field>
      <div style={noteBox()}>
        단가: {fmtUSD(AWS_RATE.voicePerMinuteUSD)}/분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
      </div>
      <div style={sectionTotal()}>콜봇 월 비용: <b>{usd(calc.callbotUSD)}</b></div>

      <Divider />

      {/* 어드바이저 */}
      <h2 style={subtitle()}>어드바이저</h2>
      <Field label="채널 수"><NumberBox value={advChannels} onChange={setAdvChannels} /></Field>
      <Field label="채널당 하루 상담수"><NumberBox value={advConsultsPerDay} onChange={setAdvConsultsPerDay} /></Field>
      <Field label="상담당 평균 통화시간(분)"><NumberBox value={advAvgMinutes} onChange={setAdvAvgMinutes} /></Field>
      <Field label="영업일(월)"><NumberBox value={advDays} onChange={setAdvDays} /></Field>
      <div style={noteBox()}>
        단가: {fmtUSD(AWS_RATE.voicePerMinuteUSD)}/분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가
      </div>
      <div style={sectionTotal()}>어드바이저 월 비용: <b>{usd(calc.advisorUSD)}</b></div>

      <Divider />

      <div style={resultBox()}>
        <h2>총 합계(월): {usd(calc.totalUSD)} ({krw(calc.totalUSD)})</h2>
      </div>
    </>
  );
}

/* ============================ 재사용 UI ============================ */
function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={field()}>
      <span style={{ fontSize: 14, color: "#111", fontWeight: 600 }}>{props.label}</span>
      <div>{props.children}</div>
    </label>
  );
}

function NumberBox({
  value, onChange, allowFloat = false,
}: { value: number; onChange: (v:number)=>void; allowFloat?: boolean }) {
  return (
    <input
      type="number"
      inputMode={allowFloat ? "decimal" : "numeric"}
      min={0}
      step={allowFloat ? 0.01 : 1}
      value={Number.isFinite(value) ? String(value) : ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      style={input()}
    />
  );
}

function ReadonlyBox({ value }: { value: string }) {
  return <input type="text" value={value} readOnly disabled style={{ ...input(), color: "#555", background: "#f8fafc" }} />;
}

function Divider() {
  return <div style={dash()}>--------</div>;
}

/* ============================ 스타일 ============================ */
const page = () => ({ padding: 16 });
const grid2Col = () => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 80,
  alignItems: "start",
  maxWidth: 1280,
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
  textAlign: "right",
  boxSizing: "border-box",
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
