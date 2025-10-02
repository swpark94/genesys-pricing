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

/* ============================ Genesys 상수 ============================ */
const UNIT = {
  callbotPerMinuteUSD: 0.06,
  chatbotPerSessionUSD: 0.02,
  advisorSTTPerMinuteUSD: 0.01,
  advisorTokenPerEachUSD: 1,
} as const;

const STT_FREE_MIN_PER_SEAT: Record<"CX1" | "CX2" | "CX3" | "CX4", number> = {
  CX1: 100, CX2: 100, CX3: 1500, CX4: 3000,
};
const ADDON_STT_MIN_PER_PACK = 1400;

/* ============================ AWS 상수 ============================ */
const AWS_RATE = {
  chatbotPerSessionUSD: 0.01,
  voicePerMinuteUSD: 0.038,
};

/* ============================ 메인 앱 ============================ */
export default function PricingApp() {
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
  // 최상단: 할인/환율
  const [discountRate, setDiscountRate] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1400);

  // CX 패키지 가격 설정(동적 반영)
  const [pkgPrice, setPkgPrice] = useState<Record<"CX1" | "CX2" | "CX3" | "CX4", number>>({
    CX1: 75, CX2: 115, CX3: 155, CX4: 240,
  });
  const [pkgFreeToken, setPkgFreeToken] = useState<Record<"CX1" | "CX2" | "CX3" | "CX4", number>>({
    CX1: 0, CX2: 0, CX3: 0, CX4: 30,
  });

  // 일반 입력
  const [cxPackage, setCxPackage] = useState<"CX1" | "CX2" | "CX3" | "CX4">("CX4");
  const [sttAddOnPacks, setSttAddOnPacks] = useState(0);

  // 챗봇
  const [chatbotChannels, setChatbotChannels] = useState(0);
  const [chatbotAvgSessionPerDay, setChatbotAvgSessionPerDay] = useState(0);
  const [daysChatbotPerMonth, setDaysChatbotPerMonth] = useState(25);

  // 콜봇
  const [callbotChannels, setCallbotChannels] = useState(0);
  const [callbotAvgCallMin, setCallbotAvgCallMin] = useState(0);
  const [callbotAnsweredPerDay, setCallbotAnsweredPerDay] = useState(0);
  const [daysCallbotPerMonth, setDaysCallbotPerMonth] = useState(25);

  // 어드바이저 (요청대로 기본 0)
  const [advisors, setAdvisors] = useState(0);
  const [advisorAvgCallMin, setAdvisorAvgCallMin] = useState(0);
  const [advisorAnsweredPerDay, setAdvisorAnsweredPerDay] = useState(0);
  const [daysAdvisorPerMonth, setDaysAdvisorPerMonth] = useState(22);
  const [advisorTokensMonthlyInput, setAdvisorTokensMonthlyInput] = useState(0);

  const pricePerSeat = pkgPrice[cxPackage];
  const freeSTTPerSeat = STT_FREE_MIN_PER_SEAT[cxPackage];
  const freeTokenPerSeat = pkgFreeToken[cxPackage];

  const calc = useMemo(() => {
    const advisorSubMonthly = advisors * pricePerSeat;

    const chatbotSessionsMonthly = chatbotChannels * chatbotAvgSessionPerDay * daysChatbotPerMonth;
    const chatbotMonthly = chatbotSessionsMonthly * UNIT.chatbotPerSessionUSD;

    const callbotMinutesMonthly = callbotChannels * callbotAnsweredPerDay * callbotAvgCallMin * daysCallbotPerMonth;
    const callbotMonthly = callbotMinutesMonthly * UNIT.callbotPerMinuteUSD;

    const advisorSTTMinutesMonthly = advisors * advisorAnsweredPerDay * advisorAvgCallMin * daysAdvisorPerMonth;
    const freeSTTMinutesMonthly = advisors * freeSTTPerSeat + sttAddOnPacks * ADDON_STT_MIN_PER_PACK;
    const sttBillableMinutes = Math.max(0, advisorSTTMinutesMonthly - freeSTTMinutesMonthly);
    const sttMonthly = sttBillableMinutes * UNIT.advisorSTTPerMinuteUSD;

    const freeTokensMonthly = advisors * freeTokenPerSeat;
    const usedTokensMonthly = advisorTokensMonthlyInput;
    const tokenBillable = Math.max(0, usedTokensMonthly - freeTokensMonthly);
    const tokenMonthly = tokenBillable * UNIT.advisorTokenPerEachUSD;

    const unusedFreeTokens = Math.max(0, freeTokensMonthly - usedTokensMonthly);
    const unusedTokenCreditUSD = unusedFreeTokens * UNIT.advisorTokenPerEachUSD;

    const advisorUsageMonthly = sttMonthly + tokenMonthly;
    const preCreditTotal = advisorSubMonthly + chatbotMonthly + callbotMonthly + advisorUsageMonthly;
    const preDiscountTotal = Math.max(0, preCreditTotal - unusedTokenCreditUSD);

    const discount = Math.max(0, Math.min(100, discountRate));
    const grandTotalMonthly = Math.max(0, preDiscountTotal * (1 - discount / 100));

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
    };
  }, [
    advisors, pricePerSeat,
    chatbotChannels, chatbotAvgSessionPerDay, daysChatbotPerMonth,
    callbotChannels, callbotAvgCallMin, callbotAnsweredPerDay, daysCallbotPerMonth,
    advisorAvgCallMin, advisorAnsweredPerDay, daysAdvisorPerMonth,
    freeSTTPerSeat, sttAddOnPacks, freeTokenPerSeat,
    advisorTokensMonthlyInput, discountRate,
  ]);

  return (
    <>
      {/* ── 타이틀 + 링크 팝오버 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ ...title(), marginBottom: 0 }}>Genesys CCaaS 요금 계산기</h1>
        <HelpTip title="관련 자료">
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <a href="https://help.mypurecloud.com/articles/genesys-cloud-tokens-based-pricing-model/"
               target="_blank" rel="noreferrer noopener" style={link()}>
              Genesys Cloud Tokens-based Pricing Model
            </a>
            <a href="https://www.genesys.com/pricing"
               target="_blank" rel="noreferrer noopener" style={link()}>
              Genesys Pricing
            </a>
            <div style={{ color: "#64748b", marginTop: 4 }}>팝오버 밖을 클릭하면 닫혀요.</div>
          </div>
        </HelpTip>
      </div>

      {/* 최상단: 할인/환율 */}
      <Field label="할인율(%)"><NumberBox value={discountRate} onChange={setDiscountRate} allowFloat /></Field>
      <Field label="환율 (USD→KRW)"><NumberBox value={exchangeRate} onChange={setExchangeRate} allowFloat /></Field>

      {/* CX 패키지 가격 설정 + 오른쪽 HelpTip(텍스트 안내만) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ ...subtitle(), marginTop: 18, marginBottom: 0 }}>CX 패키지 가격 설정</h2>
          {/* ✅ 텍스트 안내만 있는 팝오버 */}
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
            // [코드][구독료 라벨][구독료 입력][무료토큰 라벨][무료토큰 입력]
            gridTemplateColumns: "64px 140px 120px 140px 120px",
            gap: 10,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <span style={{ fontSize: 14, color: "#111", fontWeight: 700 }}>{p}</span>
          <span style={miniLabel()}>구독료(USD/석)</span>
          <NumberBox
            value={pkgPrice[p]}
            onChange={(v) => setPkgPrice((prev) => ({ ...prev, [p]: Math.max(0, v) }))}
            allowFloat
            width={120}
          />
          <span style={miniLabel()}>무료 토큰(개/석)</span>
          <NumberBox
            value={pkgFreeToken[p]}
            onChange={(v) => setPkgFreeToken((prev) => ({ ...prev, [p]: Math.max(0, v) }))}
            width={120}
          />
        </div>
      ))}

      <Divider />

      {/* 이후 입력 */}
      <Field label="CX 패키지">
        <select value={cxPackage} onChange={(e) => setCxPackage(e.target.value as any)} style={input()}>
          <option value="CX1">CX1 ({fmtUSD0(pkgPrice.CX1)}/석 · 무료토큰 {pkgFreeToken.CX1}개/석)</option>
          <option value="CX2">CX2 ({fmtUSD0(pkgPrice.CX2)}/석 · 무료토큰 {pkgFreeToken.CX2}개/석)</option>
          <option value="CX3">CX3 ({fmtUSD0(pkgPrice.CX3)}/석 · 무료토큰 {pkgFreeToken.CX3}개/석)</option>
          <option value="CX4">CX4 ({fmtUSD0(pkgPrice.CX4)}/석 · 무료토큰 {pkgFreeToken.CX4}개/석)</option>
        </select>
      </Field>

      <Field label="ADD-ON 팩(STT 1,400분/팩)"><NumberBox value={sttAddOnPacks} onChange={setSttAddOnPacks} /></Field>
      <Field label="상담사 수(석)"><NumberBox value={advisors} onChange={setAdvisors} /></Field>
      <Field label="무료 토큰(자동)"><ReadonlyBox value={`${calc.freeTokensMonthly.toLocaleString()} 개`} /></Field>

      <Divider />

      {/* 챗봇 */}
      <h2 style={subtitle()}>챗봇</h2>
      <Field label="채널 수"><NumberBox value={chatbotChannels} onChange={setChatbotChannels} /></Field>
      <Field label="채널당 하루 평균 세션"><NumberBox value={chatbotAvgSessionPerDay} onChange={setChatbotAvgSessionPerDay} /></Field>
      <Field label="영업일(월)"><NumberBox value={daysChatbotPerMonth} onChange={setDaysChatbotPerMonth} /></Field>
      <div style={noteBox()}>단가: {fmtUSD3(UNIT.chatbotPerSessionUSD)}/세션 · 산식 = 채널 × 하루 세션 × 영업일 × 세션단가</div>
      <div style={sectionTotal()}>챗봇 월 비용: <b>{fmtUSD0(calc.chatbotMonthly)} ({fmtKRW(calc.chatbotMonthly, exchangeRate)})</b></div>

      <Divider />

      {/* 콜봇 */}
      <h2 style={subtitle()}>콜봇</h2>
      <Field label="채널 수"><NumberBox value={callbotChannels} onChange={setCallbotChannels} /></Field>
      <Field label="채널당 평균 통화시간(분)"><NumberBox value={callbotAvgCallMin} onChange={setCallbotAvgCallMin} allowFloat /></Field>
      <Field label="채널당 하루 응답 콜수"><NumberBox value={callbotAnsweredPerDay} onChange={setCallbotAnsweredPerDay} /></Field>
      <Field label="영업일(월)"><NumberBox value={daysCallbotPerMonth} onChange={setDaysCallbotPerMonth} /></Field>
      <div style={noteBox()}>단가: {fmtUSD3(UNIT.callbotPerMinuteUSD)}/분 · 산식 = 채널 × 하루 응답 × 평균 통화분 × 영업일 × 분당 단가</div>
      <div style={sectionTotal()}>콜봇 월 비용: <b>{fmtUSD0(calc.callbotMonthly)} ({fmtKRW(calc.callbotMonthly, exchangeRate)})</b></div>

      <Divider />

      {/* 어드바이저 */}
      <h2 style={subtitle()}>어드바이저</h2>
      <Field label="상담사당 평균 통화시간(분)"><NumberBox value={advisorAvgCallMin} onChange={setAdvisorAvgCallMin} allowFloat /></Field>
      <Field label="상담사당 하루 응답 콜수"><NumberBox value={advisorAnsweredPerDay} onChange={setAdvisorAnsweredPerDay} /></Field>
      <Field label="영업일(월)"><NumberBox value={daysAdvisorPerMonth} onChange={setDaysAdvisorPerMonth} /></Field>
      <Field label="어드바이저 월 사용 토큰(개)"><NumberBox value={advisorTokensMonthlyInput} onChange={setAdvisorTokensMonthlyInput} /></Field>
      <div style={noteBox()}>
        STT 단가: {fmtUSD3(UNIT.advisorSTTPerMinuteUSD)}/분 · STT 산식 = 좌석 × 하루 콜 × 평균 통화분 × 영업일 − (무료 구독 STT + 무료 ADD-ON STT)<br/>
        토큰 단가: {fmtUSD3(UNIT.advisorTokenPerEachUSD)}/개 · 토큰 산식 = (입력 토큰 − 무료 토큰)⁺<br/>
        <span style={{ color: "#0a58ca", fontWeight: 700 }}>
          미사용 무료 토큰 크레딧: {calc.unusedFreeTokens.toLocaleString()} 개 → {fmtUSD0(calc.unusedTokenCreditUSD)} 총합계에서 차감
        </span>
      </div>
      <div style={sectionTotal()}>어드바이저 월 비용(STT+토큰): <b>{fmtUSD0(calc.advisorUsageMonthly)} ({fmtKRW(calc.advisorUsageMonthly, exchangeRate)})</b></div>

      <Divider />

      {/* 총합 */}
      <div style={resultBox()}>
        <h2>총 합계(월, 할인 적용): {fmtUSD0(calc.grandTotalMonthly)} ({fmtKRW(calc.grandTotalMonthly, exchangeRate)})</h2>
        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "#333" }}>
          (할인 전: {fmtUSD0(calc.preDiscountTotal)} / 할인율 {Math.max(0, Math.min(100, discountRate))}% 적용)
        </div>
      </div>
    </>
  );
}

/* ============================ AWS 계산기 ============================ */
function AwsCalculator() {
  const [awsRate, setAwsRate] = useState(1400);
  const [discountRate, setDiscountRate] = useState(0);

  const [cbtChannels, setCbtChannels] = useState(0);
  const [cbtConsultsPerDay, setCbtConsultsPerDay] = useState(0);
  const [cbtSessionsPerConsult, setCbtSessionsPerConsult] = useState(0);
  const [cbtDays, setCbtDays] = useState(25);

  const [clbChannels, setClbChannels] = useState(0);
  const [clbConsultsPerDay, setClbConsultsPerDay] = useState(0);
  const [clbAvgMinutes, setClbAvgMinutes] = useState(0);
  const [clbDays, setClbDays] = useState(25);

  const [advChannels, setAdvChannels] = useState(0);
  const [advConsultsPerDay, setAdvConsultsPerDay] = useState(0);
  const [advAvgMinutes, setAdvAvgMinutes] = useState(0);
  const [advDays, setAdvDays] = useState(22);

  const calc = useMemo(() => {
    const chatbotSessionsMonthly = cbtChannels * cbtConsultsPerDay * cbtSessionsPerConsult * cbtDays;
    const chatbotUSD = chatbotSessionsMonthly * AWS_RATE.chatbotPerSessionUSD;

    const callbotMinutesMonthly = clbChannels * clbConsultsPerDay * clbAvgMinutes * clbDays;
    const callbotUSD = callbotMinutesMonthly * AWS_RATE.voicePerMinuteUSD;

    const advisorMinutesMonthly = advChannels * advConsultsPerDay * advAvgMinutes * advDays;
    const advisorUSD = advisorMinutesMonthly * AWS_RATE.voicePerMinuteUSD;

    const preDiscountTotal = chatbotUSD + callbotUSD + advisorUSD;
    const discount = Math.max(0, Math.min(100, discountRate));
    const totalUSD = Math.max(0, preDiscountTotal * (1 - discount / 100));

    return { chatbotUSD, callbotUSD, advisorUSD, preDiscountTotal, totalUSD };
  }, [
    cbtChannels, cbtConsultsPerDay, cbtSessionsPerConsult, cbtDays,
    clbChannels, clbConsultsPerDay, clbAvgMinutes, clbDays,
    advChannels, advConsultsPerDay, advAvgMinutes, advDays,
    discountRate,
  ]);

  const usd = (n: number) => fmtUSD0(n);
  const krw = (n: number) => fmtKRW(n, awsRate);

  return (
    <>
      {/* ── 타이틀 + 링크 팝오버 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ ...title(), marginBottom: 0 }}>AWS CCaaS 요금 계산기 (all-inclusive 기준)</h1>
        <HelpTip title="관련 자료">
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <a href="https://aws.amazon.com/ko/connect/pricing/"
               target="_blank" rel="noreferrer noopener" style={link()}>
              Amazon Connect Pricing
            </a>
            <div style={{ color: "#64748b", marginTop: 4 }}>팝오버 밖을 클릭하면 닫혀요.</div>
          </div>
        </HelpTip>
      </div>

      <Field label="할인율(%)"><NumberBox value={discountRate} onChange={setDiscountRate} allowFloat /></Field>
      <Field label="환율 (USD→KRW)"><NumberBox value={awsRate} onChange={setAwsRate} allowFloat /></Field>

      <Divider />

      <h2 style={subtitle()}>챗봇</h2>
      <Field label="채널 수"><NumberBox value={cbtChannels} onChange={setCbtChannels} /></Field>
      <Field label="채널당 하루 상담수"><NumberBox value={cbtConsultsPerDay} onChange={setCbtConsultsPerDay} /></Field>
      <Field label="상담당 세션수"><NumberBox value={cbtSessionsPerConsult} onChange={setCbtSessionsPerConsult} /></Field>
      <Field label="영업일(월)"><NumberBox value={cbtDays} onChange={setCbtDays} /></Field>
      <div style={noteBox()}>단가: {fmtUSD3(AWS_RATE.chatbotPerSessionUSD)} /세션 · 산식 = 채널 × 하루 상담수 × 상담당 세션수 × 영업일 × 세션단가</div>
      <div style={sectionTotal()}>챗봇 월 비용: <b>{usd(calc.chatbotUSD)} ({krw(calc.chatbotUSD)})</b></div>

      <Divider />

      <h2 style={subtitle()}>콜봇</h2>
      <Field label="채널 수"><NumberBox value={clbChannels} onChange={setClbChannels} /></Field>
      <Field label="채널당 하루 상담수"><NumberBox value={clbConsultsPerDay} onChange={setClbConsultsPerDay} /></Field>
      <Field label="상담당 평균 통화시간(분)"><NumberBox value={clbAvgMinutes} onChange={setClbAvgMinutes} /></Field>
      <Field label="영업일(월)"><NumberBox value={clbDays} onChange={setClbDays} /></Field>
      <div style={noteBox()}>단가: {fmtUSD3(AWS_RATE.voicePerMinuteUSD)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가</div>
      <div style={sectionTotal()}>콜봇 월 비용: <b>{usd(calc.callbotUSD)} ({krw(calc.callbotUSD)})</b></div>

      <Divider />

      <h2 style={subtitle()}>어드바이저</h2>
      <Field label="채널 수"><NumberBox value={advChannels} onChange={setAdvChannels} /></Field>
      <Field label="채널당 하루 상담수"><NumberBox value={advConsultsPerDay} onChange={setAdvConsultsPerDay} /></Field>
      <Field label="상담당 평균 통화시간(분)"><NumberBox value={advAvgMinutes} onChange={setAdvAvgMinutes} /></Field>
      <Field label="영업일(월)"><NumberBox value={advDays} onChange={setAdvDays} /></Field>
      <div style={noteBox()}>단가: {fmtUSD3(AWS_RATE.voicePerMinuteUSD)} /분 · 산식 = 채널 × 하루 상담수 × 상담당 평균 통화시간 × 영업일 × 분당 단가</div>
      <div style={sectionTotal()}>어드바이저 월 비용: <b>{usd(calc.advisorUSD)} ({krw(calc.advisorUSD)})</b></div>

      <Divider />

      <div style={resultBox()}>
        <h2>총 합계(월, 할인 적용): {usd(calc.totalUSD)} ({krw(calc.totalUSD)})</h2>
        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "#333" }}>
          (할인 전: {usd(calc.preDiscountTotal)} / 할인율 {Math.max(0, Math.min(100, discountRate))}% 적용)
        </div>
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

function NumberBox({
  value, onChange, allowFloat = false, width,
}: { value: number; onChange: (v:number)=>void; allowFloat?: boolean; width?: number }) {
  const [raw, setRaw] = useState(String(value ?? ""));
  useEffect(() => { setRaw(String(value ?? "")); }, [value]);

  return (
    <input
      type="text"
      inputMode={allowFloat ? "decimal" : "numeric"}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        const num = Number(v);
        if (!Number.isNaN(num)) onChange(num);
      }}
      onBlur={() => {
        const num = Number(raw);
        const fixed = Number.isNaN(num) ? 0 : num;
        onChange(fixed);
        setRaw(String(fixed));
      }}
      style={{ ...input(), width: width ? width : "100%" }}
    />
  );
}

function ReadonlyBox({ value }: { value: string }) {
  return <input type="text" value={value} readOnly disabled style={{ ...input(), color: "#555", background: "#f8fafc" }} />;
}

function Divider() { return <div style={dash()}>--------</div>; }

/* ============================ HelpTip(팝오버) ============================ */
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

const page = () => ({ padding: 16 });

// 좌우 카드 폭 비슷하게 + 간격 유지
const grid2Col = () => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(600px, 1fr))",
  gap: 56,
  alignItems: "start",
  maxWidth: 1320,
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
  maxWidth: 1320,
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
