// 🔑 OpenWeather API 키
const API_KEY = "05716097881b1e14f33cda253afae3f2"; // 나중에 Vercel 환경변수로 옮겨도 됨

const $ = (sel) => document.querySelector(sel);

// 상태
const state = {
  unit: "metric", // "metric" or "imperial"
  lastGeo: null, // {lat, lon, name, country}
};

const RECENT_KEY = "weather_recent_cities";

// ----------------------
// 1) 도시 → 위도·경도 (Geocoding)
// ----------------------
async function resolveCity(cityName) {
  if (!API_KEY || API_KEY === "AIzaSyDTm2zZTzsCF2UDhyCvndeQ_5lrXY8Cvks") {
    throw new Error("API_KEY가 설정되어 있지 않습니다.");
  }
  if (!cityName) throw new Error("도시 이름을 입력해 주세요.");

  const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
  url.searchParams.set("q", cityName); // 한글/영어 모두 지원
  url.searchParams.set("limit", "1");
  url.searchParams.set("appid", API_KEY);
  url.searchParams.set("lang", "kr");

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "도시 정보를 찾지 못했습니다.");
  }
  if (!data.length) {
    throw new Error("해당 도시를 찾을 수 없습니다.");
  }

  const { name, country, lat, lon, state: region } = data[0];
  return { name, country, lat, lon, region };
}

// ----------------------
// 2) 현재 날씨 & 예보
// ----------------------
async function getCurrentByCoords(lat, lon) {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("appid", API_KEY);
  url.searchParams.set("units", state.unit);
  url.searchParams.set("lang", "kr");

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "현재 날씨 불러오기 실패");
  return data;
}

async function getForecastByCoords(lat, lon) {
  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("appid", API_KEY);
  url.searchParams.set("units", state.unit);
  url.searchParams.set("lang", "kr");

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "예보 불러오기 실패");
  return data;
}

// ----------------------
// 3) UI 업데이트 헬퍼
// ----------------------
function setTheme(weatherId, isNight) {
  document.body.className = ""; // reset
  if (isNight) {
    document.body.classList.add("theme-night");
    return;
  }

  if (weatherId >= 200 && weatherId < 600) {
    document.body.classList.add("theme-rain");
  } else if (weatherId >= 600 && weatherId < 700) {
    document.body.classList.add("theme-snow");
  } else if (weatherId === 800) {
    document.body.classList.add("theme-clear");
  } else if (weatherId > 800) {
    document.body.classList.add("theme-clouds");
  } else {
    document.body.classList.add("theme-clouds");
  }
}

function unitLabel() {
  return state.unit === "metric"
    ? { temp: "°C", wind: "m/s" }
    : { temp: "°F", wind: "mph" };
}

function fmtTemp(t) {
  if (t === undefined || t === null) return "--°";
  return Math.round(t) + unitLabel().temp;
}

// 옷차림 추천 (확장 기능)
function getOutfitTip(tempC, weatherId, wind) {
  // tempC가 화씨일 수도 있으니 섭씨로 환산
  let c = tempC;
  if (state.unit === "imperial") {
    c = ((tempC - 32) * 5) / 9;
  }

  const windy = wind >= 8; // 8m/s 이상 바람 쎈편
  const isRain = weatherId >= 200 && weatherId < 600;
  const isSnow = weatherId >= 600 && weatherId < 700;

  if (isSnow || c <= 0) {
    return "두꺼운 패딩, 목도리, 장갑을 꼭 챙기세요 ⛄";
  }
  if (c <= 8) {
    return "코트나 두꺼운 자켓이 좋겠어요. 겹쳐 입는 걸 추천해요.";
  }
  if (c <= 16) {
    return "야상/가죽자켓이나 니트에 얇은 겉옷 정도가 적당해요.";
  }
  if (c <= 23) {
    if (isRain) return "가벼운 옷차림 + 우산을 챙기세요 ☔";
    return "맨투맨, 얇은 니트, 긴바지 정도면 편한 날씨예요.";
  }
  if (c <= 28) {
    return "반팔에 얇은 바지나 반바지가 좋아요. 햇빛이 강하면 모자도!";
  }
  // 29도 이상
  return "매우 덥습니다 🥵 최대한 시원한 옷차림 + 물 자주 마시기!";
}

// 최근 검색어
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(city) {
  if (!city) return;
  const list = loadRecent();
  const withoutDup = list.filter(
    (c) => c.toLowerCase() !== city.toLowerCase()
  );
  const next = [city, ...withoutDup].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function renderRecent() {
  const box = $("#recentBox");
  const list = loadRecent();
  box.innerHTML = "";
  list.forEach((city) => {
    const btn = document.createElement("button");
    btn.textContent = city;
    btn.addEventListener("click", () => search(city));
    box.appendChild(btn);
  });
}

// ----------------------
// 4) 렌더링
// ----------------------
function displayCurrent(data, geo) {
  const weather = data.weather[0];
  $("#temp").textContent = fmtTemp(data.main.temp);
  $("#desc").textContent = weather.description;
  $("#place").textContent = `${geo.name}, ${geo.country}`;
  $("#humidity").textContent = data.main.humidity ?? "--";
  $("#wind").textContent = data.wind.speed ?? "--";
  $("#windUnit").textContent = unitLabel().wind;

  $("#icon").src = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`;
  $("#icon").alt = weather.description;

  const isNight = weather.icon.endsWith("n");
  setTheme(weather.id, isNight);

  const tip = getOutfitTip(data.main.temp, weather.id, data.wind.speed || 0);
  $("#outfitTip").textContent = tip;

  // ⭐⭐ 여기부터 추가됨 ⭐⭐

  // 일출·일몰 계산
  const sunrise = new Date((data.sys.sunrise + data.timezone) * 1000);
  const sunset  = new Date((data.sys.sunset  + data.timezone) * 1000);

  const fmtTime = (d) =>
    d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  $("#sunInfo").textContent =
    `일출 ${fmtTime(sunrise)} · 일몰 ${fmtTime(sunset)}`;
}


function displayForecast(forecast) {
  const grid = $("#forecastGrid");
  grid.innerHTML = "";

  const tz = forecast.city.timezone || 0;
  const byDay = {};

  (forecast.list || []).forEach((item) => {
    const local = new Date((item.dt + tz) * 1000);
    const dayKey = local.toISOString().split("T")[0];
    const score = Math.abs(local.getUTCHours() - 13); // 정오 근처 선호
    if (!byDay[dayKey] || score < byDay[dayKey].score) {
      byDay[dayKey] = { item, local, score };
    }
  });

  const days = Object.values(byDay)
    .sort((a, b) => a.local - b.local)
    .slice(0, 5);

  days.forEach(({ item, local }) => {
    const w = item.weather[0];
    const div = document.createElement("div");
    div.className = "forecast-item";
    div.innerHTML = `
      <div class="forecast-date">
        ${local.toLocaleDateString("ko-KR", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      <img src="https://openweathermap.org/img/wn/${w.icon}@2x.png"
            width="60" height="60" alt="${w.description}" />
      <div class="forecast-temp">${fmtTemp(item.main.temp)}</div>
      <div class="muted">${w.description}</div>
    `;
    grid.appendChild(div);
  });
}

// ----------------------
// 5) 에러 처리
// ----------------------
function showError(msg) {
  const box = $("#errorBox");
  box.textContent = "에러: " + msg;
  box.style.display = "block";
  setTimeout(() => {
    box.style.display = "none";
  }, 4000);
}

// ----------------------
// 6) 검색 흐름
// ----------------------
async function search(rawCity) {
  const inputEl = $("#cityInput");
  const cityName = (rawCity ?? inputEl.value).trim();
  if (!cityName) {
    showError("도시를 입력해 주세요.");
    return;
  }

  try {
    const geo = await resolveCity(cityName);
    state.lastGeo = geo;

    const [current, forecast] = await Promise.all([
      getCurrentByCoords(geo.lat, geo.lon),
      getForecastByCoords(geo.lat, geo.lon),
    ]);

    displayCurrent(current, geo);
    displayForecast(forecast);
    saveRecent(geo.name);
    renderRecent();
  } catch (e) {
    showError(e.message);
  }
}

// ----------------------
// 7) 이벤트 바인딩
// ----------------------
$("#searchBtn").addEventListener("click", () => search());
$("#cityInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});

$("#unitToggle").addEventListener("click", () => {
  state.unit = state.unit === "metric" ? "imperial" : "metric";
  // 현재 도시 다시 조회
  if (state.lastGeo) {
    search(state.lastGeo.name);
  } else {
    search("서울");
  }
});

// ----------------------
// 8) 초기화
// ----------------------
function init() {
  renderRecent();
  renderQuote();  // ⭐ 랜덤 명언 표시
  const first = loadRecent()[0] || "서울";
  $("#cityInput").value = first;
  search(first);
}
const quotes = [
  "하늘은 스스로 돕는 자를 돕는다.",
  "오늘의 날씨처럼 마음도 맑아지길.",
  "작은 변화가 내일을 바꾼다.",
  "포기하지 마. 기적은 생각보다 가까워.",
  "느리더라도 꾸준히 가면 결국 닿는다.",
  "행복은 준비된 마음에서 시작된다.",
  "지금 이 순간도 충분히 아름답다."
];

function renderQuote() {
  const box = document.getElementById("quoteBox");
  const pick = quotes[Math.floor(Math.random() * quotes.length)];
  box.textContent = pick;
}

init();
