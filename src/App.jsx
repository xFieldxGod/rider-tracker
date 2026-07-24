import { useState, useEffect, useRef, Fragment } from 'react';
import { Home, Map as MapIcon, BarChart2, History as HistoryIcon, User, CheckCircle2, Target, Plus, Navigation, AlertTriangle, X, Package, Layers, MapPin, Flame, Radio, Compass, Sliders, Clock, TrendingUp, Calendar, Zap, Award, Fuel, DollarSign, Volume2, Trash2, CloudCheck, ShieldCheck, Download, Smartphone, Gauge, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, provider, db } from './firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const FUEL_TYPE_LABELS = {
  gasohol95: 'แก๊สโซฮอล์ 95',
  gasohol91: 'แก๊สโซฮอล์ 91',
  gasoholE20: 'E20'
};

// Pleasant Victory Audio Synthesizer (Played when goal is reached)
function playGoalReachedSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.45);
    });
  } catch (e) {
    console.warn("Audio Context error:", e);
  }
}

// Dynamic Rider Location Marker with Customizable Size (24px to 56px), rotates to face travel direction
const createRiderIcon = (size = 36, heading = null) => L.divIcon({
  className: 'leaflet-custom-icon',
  html: `
    <div class="relative flex items-center justify-center z-50">
      <span style="width: ${size}px; height: ${size}px;" class="animate-ping absolute inline-flex rounded-full bg-[#22c55e] opacity-60"></span>
      <div style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.45)}px; transform: rotate(${heading ?? 0}deg); transition: transform 0.3s ease-out;" class="bg-[#22c55e] text-white rounded-full border-2 border-white shadow-xl flex items-center justify-center font-black relative z-50">
        🛵
      </div>
    </div>
  `,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2]
});

// Active Job Pin with Dynamic Vertical Stacking Offset (idx * 26px)
const createJobIcon = (num, idx) => {
  const offsetY = 28 + idx * 26;
  return L.divIcon({
    className: 'leaflet-custom-icon',
    html: `
      <div style="transform: translateY(-${offsetY}px);" class="flex flex-col items-center">
        <div class="bg-[#16a34a] text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-lg border-2 border-white text-[11px] flex items-center gap-1 whitespace-nowrap">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>งาน #${num}</span>
        </div>
        <div class="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-[#16a34a] -mt-0.5"></div>
      </div>
    `,
    iconSize: [70, 36],
    iconAnchor: [35, 36]
  });
};

// Compact Collapsed Job Badge for Zoomed Out Map View
const createCompactClusterIcon = (count) => L.divIcon({
  className: 'leaflet-custom-icon',
  html: `
    <div class="-translate-y-6 flex flex-col items-center z-40">
      <div class="bg-amber-500 text-white font-black px-2.5 py-1 rounded-full shadow-lg border-2 border-white text-xs flex items-center gap-1 whitespace-nowrap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span>${count} ออเดอร์</span>
      </div>
      <div class="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-amber-500 -mt-0.5"></div>
    </div>
  `,
  iconSize: [80, 30],
  iconAnchor: [40, 30]
});

// Hotspot Zone Pin (Positioned BELOW the coordinate point)
const createHotspotIcon = (rank, count) => L.divIcon({
  className: 'leaflet-custom-icon',
  html: `
    <div className="translate-y-4 flex flex-col items-center">
      <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-orange-500 -mb-0.5"></div>
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-lg border-2 border-white text-[10px] flex items-center gap-1 whitespace-nowrap">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.4 2.3 2 4.2 4 5.5 2.5 1.7 4 4.5 4 7.5 0 4.4-3.6 8-8 8s-8-3.6-8-8c0-2.4 1.1-4.7 3-6.1C8.8 7.5 11 4.5 12 2z"/></svg>
        <span>โซน ${rank} (${count} งาน)</span>
      </div>
    </div>
  `,
  iconSize: [95, 36],
  iconAnchor: [47, 0]
});

// Haversine distance in kilometers
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Cluster jobs into Hotspot Zones (~800 meters radius)
function clusterZones(pts) {
  const ZONE_KM = 0.8;
  const zonesArr = [];

  pts.forEach((j) => {
    if (j.lat == null || j.lng == null) return;
    let best = null;
    let bd = ZONE_KM;

    zonesArr.forEach((z) => {
      const d = haversine(j.lat, j.lng, z.lat, z.lng);
      if (d < bd) {
        bd = d;
        best = z;
      }
    });

    if (best) {
      best.pts.push(j);
      best.lat = best.pts.reduce((s, p) => s + p.lat, 0) / best.pts.length;
      best.lng = best.pts.reduce((s, p) => s + p.lng, 0) / best.pts.length;
    } else {
      zonesArr.push({ lat: j.lat, lng: j.lng, pts: [j] });
    }
  });

  zonesArr.forEach((z) => {
    z.n = z.pts.length;
    z.rKm = 0.25;
    z.pts.forEach((p) => {
      z.rKm = Math.max(z.rKm, haversine(p.lat, p.lng, z.lat, z.lng) + 0.15);
    });
  });

  return zonesArr.sort((a, b) => b.n - a.n);
}

// SMART ANALYTICS: Calculate Peak Days & Time Slots
function computeSmartRiderAnalytics(completedJobs) {
  const DAY_NAMES = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const dayStats = {};
  DAY_NAMES.forEach(d => { dayStats[d] = { count: 0, amt: 0 }; });

  const timeSlotStats = {
    'เช้า (06:00 - 11:00)': 0,
    'เที่ยง (11:00 - 14:00)': 0,
    'บ่าย (14:00 - 17:00)': 0,
    'เย็น (17:00 - 21:00)': 0,
    'ดึก (21:00 - 06:00)': 0,
  };

  completedJobs.forEach(job => {
    const date = new Date(job.done || job.at || job.id);
    const dayName = DAY_NAMES[date.getDay()];
    dayStats[dayName].count += (job.count || 1);
    dayStats[dayName].amt += (job.amt || 0);

    const hour = date.getHours();
    if (hour >= 6 && hour < 11) timeSlotStats['เช้า (06:00 - 11:00)'] += (job.count || 1);
    else if (hour >= 11 && hour < 14) timeSlotStats['เที่ยง (11:00 - 14:00)'] += (job.count || 1);
    else if (hour >= 14 && hour < 17) timeSlotStats['บ่าย (14:00 - 17:00)'] += (job.count || 1);
    else if (hour >= 17 && hour < 21) timeSlotStats['เย็น (17:00 - 21:00)'] += (job.count || 1);
    else timeSlotStats['ดึก (21:00 - 06:00)'] += (job.count || 1);
  });

  let peakDay = null;
  let maxDayCount = -1;
  Object.keys(dayStats).forEach(day => {
    if (dayStats[day].count > maxDayCount && dayStats[day].count > 0) {
      maxDayCount = dayStats[day].count;
      peakDay = { name: day, count: dayStats[day].count, amt: dayStats[day].amt };
    }
  });

  let peakTimeSlot = null;
  let maxTimeCount = -1;
  Object.keys(timeSlotStats).forEach(slot => {
    if (timeSlotStats[slot] > maxTimeCount && timeSlotStats[slot] > 0) {
      maxTimeCount = timeSlotStats[slot];
      peakTimeSlot = { name: slot, count: timeSlotStats[slot] };
    }
  });

  return { dayStats, timeSlotStats, peakDay, peakTimeSlot };
}

// Helper component to listen for zoom/drag events & keep the map centered on the rider (follow mode)
function MapController({ coords, zoom, onZoomChange, isFollowing, onUserDrag, focusTrigger }) {
  const map = useMapEvents({
    zoomend() {
      if (onZoomChange) {
        onZoomChange(map.getZoom());
      }
    },
    dragstart() {
      if (isFollowing && onUserDrag) {
        onUserDrag();
      }
    }
  });

  // Continuous follow: gentle recenter on every GPS update, no animation restart -> no shake
  useEffect(() => {
    if (isFollowing && coords && coords[0] && coords[1]) {
      map.setView(coords, zoom || map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [coords, isFollowing]);

  // Explicit "jump to point" (job pin / hotspot / locate-me button) — full animated flyTo
  useEffect(() => {
    if (focusTrigger && coords && coords[0] && coords[1]) {
      map.flyTo(coords, zoom || 17, { animate: true, duration: 1.2 });
    }
  }, [focusTrigger]);

  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const isInitialCloudSyncRef = useRef(false);

  // PWA Install Prompt state — only worth showing on phones, not desktop browsers
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const [jobs, setJobs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rider.jobs.react')) || [];
    } catch { return []; }
  });

  const [goal, setGoal] = useState(() => {
    try {
      return Number(localStorage.getItem('rider.goal')) || 1000;
    } catch { return 1000; }
  });

  // GPS Odometer Distance & Auto Distance-Based Fuel Calculator state
  const [todayKm, setTodayKm] = useState(() => {
    try {
      const savedDate = localStorage.getItem('rider.kmDate');
      if (savedDate === new Date().toDateString()) {
        return Number(localStorage.getItem('rider.todayKm')) || 0;
      }
      return 0;
    } catch { return 0; }
  });

  const [kmPerLiter, setKmPerLiter] = useState(() => {
    try { return Number(localStorage.getItem('rider.kmPerLiter')) || 45; } catch { return 45; }
  });

  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(() => {
    try { return Number(localStorage.getItem('rider.fuelPrice')) || 38; } catch { return 38; }
  });

  const [isAutoFuel, setIsAutoFuel] = useState(() => {
    try { return localStorage.getItem('rider.isAutoFuel') !== 'false'; } catch { return true; }
  });

  // Which fuel grade the rider's bike takes — used to pick the right price when auto-fetching
  const [fuelType, setFuelType] = useState(() => {
    try { return localStorage.getItem('rider.fuelType') || 'gasohol95'; } catch { return 'gasohol95'; }
  });

  const [manualFuelCost, setManualFuelCost] = useState(() => {
    try { return Number(localStorage.getItem('rider.manualFuelCost')) || 0; } catch { return 0; }
  });

  // Calculated Fuel Cost (Auto from GPS distance or Manual)
  const calculatedFuelCost = isAutoFuel
    ? Math.round((todayKm / (kmPerLiter || 45)) * (fuelPricePerLiter || 38))
    : manualFuelCost;

  const [riderIconSize, setRiderIconSize] = useState(() => {
    try {
      return Number(localStorage.getItem('rider.iconSize')) || 36;
    } catch { return 36; }
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Shift (start/stop work) state — must start a shift before accepting jobs
  const [currentShiftStart, setCurrentShiftStart] = useState(() => {
    try { return Number(localStorage.getItem('rider.currentShiftStart')) || null; } catch { return null; }
  });
  const [shifts, setShifts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rider.shifts')) || []; } catch { return []; }
  });
  const [shiftElapsedLabel, setShiftElapsedLabel] = useState('0.0');
  const [isStopShiftModalOpen, setIsStopShiftModalOpen] = useState(false);

  // Real-Time GPS Tracking & Odometer state
  const [userCoords, setUserCoords] = useState([13.7563, 100.5018]);
  const [userHeading, setUserHeading] = useState(null);
  const prevCoordsRef = useRef(null);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [focusedCoords, setFocusedCoords] = useState(null);
  const [mapZoom, setMapZoom] = useState(17);
  const [currentZoomLevel, setCurrentZoomLevel] = useState(15);
  const [isFollowing, setIsFollowing] = useState(true);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const watchIdRef = useRef(null);

  // Modals state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [tempFuel, setTempFuel] = useState('');
  const [tempKmPerL, setTempKmPerL] = useState('');
  const [tempFuelPrice, setTempFuelPrice] = useState('');
  const [isFetchingFuelPrice, setIsFetchingFuelPrice] = useState(false);
  const [fuelPriceFetchError, setFuelPriceFetchError] = useState(false);
  const [fuelPriceFetchedAt, setFuelPriceFetchedAt] = useState(null);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [historyToDelete, setHistoryToDelete] = useState(null);
  const [isClearAllHistoryModalOpen, setIsClearAllHistoryModalOpen] = useState(false);

  // Batch Amount Input per batchId
  const [batchAmounts, setBatchAmounts] = useState({});

  // LISTEN TO PWA INSTALL PROMPT
  useEffect(() => {
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
        setDeferredInstallPrompt(null);
      }
    }
  };

  // FIREBASE AUTHENTICATION LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setIsCloudSynced(false);
    });
    return () => unsubscribe();
  }, []);

  // FIREBASE FIRESTORE REAL-TIME DATABASE SYNC
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "riders", user.uid);

    const unsubFirestore = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data();
        if (!isInitialCloudSyncRef.current) {
          isInitialCloudSyncRef.current = true;
          if (cloudData.jobs) setJobs(cloudData.jobs);
          if (cloudData.goal) setGoal(cloudData.goal);
          if (cloudData.todayKm !== undefined) setTodayKm(cloudData.todayKm);
          if (cloudData.kmPerLiter) setKmPerLiter(cloudData.kmPerLiter);
          if (cloudData.fuelPricePerLiter) setFuelPricePerLiter(cloudData.fuelPricePerLiter);
          if (cloudData.riderIconSize) setRiderIconSize(cloudData.riderIconSize);
        }
      }
      setIsCloudSynced(true);
    }, (err) => console.warn("Firestore sync error:", err));

    return () => unsubFirestore();
  }, [user]);

  // SAVE LOCALSTORAGE & AUTO-SYNC TO FIRESTORE
  useEffect(() => {
    localStorage.setItem('rider.jobs.react', JSON.stringify(jobs));
    localStorage.setItem('rider.goal', goal.toString());
    localStorage.setItem('rider.todayKm', todayKm.toString());
    localStorage.setItem('rider.kmDate', new Date().toDateString());
    localStorage.setItem('rider.kmPerLiter', kmPerLiter.toString());
    localStorage.setItem('rider.fuelPrice', fuelPricePerLiter.toString());
    localStorage.setItem('rider.isAutoFuel', isAutoFuel.toString());
    localStorage.setItem('rider.fuelType', fuelType);
    localStorage.setItem('rider.manualFuelCost', manualFuelCost.toString());
    localStorage.setItem('rider.iconSize', riderIconSize.toString());
    localStorage.setItem('rider.currentShiftStart', currentShiftStart ? currentShiftStart.toString() : '');
    localStorage.setItem('rider.shifts', JSON.stringify(shifts));

    if (user) {
      const docRef = doc(db, "riders", user.uid);
      setDoc(docRef, {
        jobs,
        goal,
        todayKm,
        calculatedFuelCost,
        kmPerLiter,
        fuelPricePerLiter,
        riderIconSize,
        email: user.email,
        displayName: user.displayName,
        updatedAt: Date.now()
      }, { merge: true }).catch(err => console.warn("Cloud save error:", err));
    }
  }, [jobs, goal, todayKm, calculatedFuelCost, kmPerLiter, fuelPricePerLiter, isAutoFuel, fuelType, manualFuelCost, riderIconSize, currentShiftStart, shifts, user]);

  // GPS marker position always tracks live so "locate me" stays accurate whether or not a shift is active;
  // only the odometer distance accumulation (used for fuel cost) is gated to an active shift.
  const isShiftActiveRef = useRef(false);
  useEffect(() => {
    isShiftActiveRef.current = !!currentShiftStart;
  }, [currentShiftStart]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      setIsLiveTracking(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newCoords = [pos.coords.latitude, pos.coords.longitude];

          // ODOMETER ACCUMULATION LOGIC (only counts distance while a shift is active)
          if (isShiftActiveRef.current && prevCoordsRef.current) {
            const distKm = haversine(
              prevCoordsRef.current[0],
              prevCoordsRef.current[1],
              newCoords[0],
              newCoords[1]
            );
            // Filter noise: accumulate if movement > 5 meters (0.005 km) and < 2.0 km per update
            if (distKm > 0.005 && distKm < 2.0) {
              setTodayKm(prev => Number((prev + distKm).toFixed(2)));
            }
          }

          prevCoordsRef.current = newCoords;
          setUserCoords(newCoords);
          if (pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)) {
            setUserHeading(pos.coords.heading);
          }
        },
        (err) => {
          console.warn("Live GPS watch error:", err);
          setIsLiveTracking(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // LIVE SHIFT DURATION TICKER (updates every minute while a shift is active)
  useEffect(() => {
    if (!currentShiftStart) {
      setShiftElapsedLabel('0.0');
      return;
    }
    const update = () => setShiftElapsedLabel(((Date.now() - currentShiftStart) / 3600000).toFixed(1));
    update();
    const intervalId = setInterval(update, 60000);
    return () => clearInterval(intervalId);
  }, [currentShiftStart]);

  // Start/stop the work shift. Stopping while jobs are still pending asks for confirmation first.
  const handleToggleShift = () => {
    if (currentShiftStart) {
      const hasPendingJobs = jobs.some(j => j.done === null);
      if (hasPendingJobs) {
        setIsStopShiftModalOpen(true);
        return;
      }
      stopShift();
    } else {
      setCurrentShiftStart(Date.now());
    }
  };

  const stopShift = () => {
    setShifts(prev => [...prev, { start: currentShiftStart, end: Date.now() }]);
    setCurrentShiftStart(null);
    setIsStopShiftModalOpen(false);
  };

  // Fetch today's retail price for the rider's chosen fuel grade (Bangchak, via Netlify Function proxy)
  const fetchLatestFuelPrice = async () => {
    setIsFetchingFuelPrice(true);
    setFuelPriceFetchError(false);
    try {
      const res = await fetch('/.netlify/functions/fuel-price');
      if (!res.ok) throw new Error('bad_response');
      const data = await res.json();
      const priceByType = { gasohol95: data.gasohol95, gasohol91: data.gasohol91, gasoholE20: data.gasoholE20 };
      const price = priceByType[fuelType] ?? data.gasohol95 ?? data.gasohol91 ?? data.gasoholE20;
      if (!price) throw new Error('no_price');
      setTempFuelPrice(price.toString());
      setFuelPriceFetchedAt(data.date || new Date().toLocaleDateString('th-TH'));
    } catch {
      setFuelPriceFetchError(true);
    } finally {
      setIsFetchingFuelPrice(false);
    }
  };


  // Re-center on rider & resume continuous follow mode (like Google Maps' recenter button)
  const handleLocateMe = () => {
    setFocusedCoords(null);
    setMapZoom(17);
    setIsFollowing(true);
    setFocusTrigger(t => t + 1);
  };

  const activeJobs = jobs.filter(j => j.done === null);

  const activeBatchIds = [...new Set(activeJobs.map(j => j.batchId || 1))];
  const latestBatchId = activeBatchIds.length > 0 ? Math.max(...activeBatchIds) : 1;

  const addJobWithLocation = (batchId) => {
    const now = Date.now();
    const newJob = {
      id: now,
      at: now,
      amt: null,
      done: null,
      batchId,
      lat: userCoords[0],
      lng: userCoords[1]
    };
    setJobs(prev => [newJob, ...prev]);
  };

  const addJobToCurrentBatch = () => {
    if (!currentShiftStart) return;
    const targetBatchId = activeJobs.length === 0 ? 1 : latestBatchId;
    const jobsInBatch = activeJobs.filter(j => (j.batchId || 1) === targetBatchId);
    if (jobsInBatch.length >= 4) return;
    addJobWithLocation(targetBatchId);
  };

  const startNewBatch = () => {
    if (!currentShiftStart) return;
    const newBatchId = latestBatchId + 1;
    addJobWithLocation(newBatchId);
  };

  const handleViewJobOnMap = (job) => {
    setIsFollowing(false);
    setFocusedCoords([job.lat, job.lng]);
    setMapZoom(17);
    setActiveTab('map');
    setFocusTrigger(t => t + 1);
  };

  const finishSpecificBatch = (bId) => {
    const amtVal = batchAmounts[bId];
    if (!amtVal || isNaN(amtVal) || Number(amtVal) <= 0) return;

    const totalAmt = Number(amtVal);
    const now = Date.now();
    const batchJobs = activeJobs.filter(j => (j.batchId || 1) === bId);
    const count = batchJobs.length;

    let assigned = false;
    const updated = jobs.map(j => {
      if (j.done === null && (j.batchId || 1) === bId) {
        if (!assigned) {
          assigned = true;
          return { ...j, amt: totalAmt, done: now, count };
        }
        return { ...j, amt: 0, done: now, count };
      }
      return j;
    });

    setJobs(updated);
    setBatchAmounts({ ...batchAmounts, [bId]: '' });

    const doneAfter = updated.filter(j => j.done !== null && j.amt > 0 && new Date(j.done).toDateString() === new Date().toDateString());
    const sumAfter = doneAfter.reduce((acc, j) => acc + (j.amt || 0), 0);

    if (sumAfter >= goal) {
      playGoalReachedSound();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 9999, colors: ['#22c55e', '#eab308', '#ffffff'] });
    } else {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, zIndex: 9999, colors: ['#22c55e', '#16a34a', '#ffffff'] });
    }
  };

  const confirmDeleteJob = () => {
    if (jobToDelete !== null) {
      setJobs(jobs.filter(j => j.id !== jobToDelete));
      setJobToDelete(null);
    }
  };

  const confirmDeleteHistoryItem = () => {
    if (historyToDelete !== null) {
      const targetJob = jobs.find(j => j.id === historyToDelete);
      if (targetJob) {
        const targetBatchId = targetJob.batchId;
        const targetDone = targetJob.done;

        setJobs(jobs.filter(j => {
          if (j.id === historyToDelete) return false;
          if (targetBatchId && j.batchId === targetBatchId && j.done !== null) return false;
          if (targetDone && j.done === targetDone) return false;
          return true;
        }));
      }
      setHistoryToDelete(null);
    }
  };

  const confirmClearAllHistory = () => {
    setJobs([]);
    setTodayKm(0);
    localStorage.removeItem('rider.jobs.react');
    localStorage.setItem('rider.todayKm', '0');
    if (user) {
      setDoc(doc(db, "riders", user.uid), { jobs: [], todayKm: 0 }, { merge: true });
    }
    setIsClearAllHistoryModalOpen(false);
  };

  const saveGoalAndFuel = () => {
    const numG = Number(tempGoal);
    if (numG > 0) setGoal(numG);

    const numKmL = Number(tempKmPerL);
    if (numKmL > 0) setKmPerLiter(numKmL);

    const numFP = Number(tempFuelPrice);
    if (numFP > 0) setFuelPricePerLiter(numFP);

    const numF = Number(tempFuel);
    if (!isNaN(numF) && numF >= 0) setManualFuelCost(numF);

    setIsGoalModalOpen(false);
  };

  // REACTIVE STATS COMPUTATION
  // Batch orders are stored as one job row per order, but only the first row in a
  // finished batch carries the money (amt > 0) to avoid double-counting revenue —
  // so `doneJobs` (money-bearing rows) undercounts orders. Use `completedJobs` for
  // anything that counts individual orders (map pins, history list, avg per order).
  const doneJobs = jobs.filter(j => j.done !== null && j.amt > 0);
  const completedJobs = jobs.filter(j => j.done !== null);
  const todayDone = doneJobs.filter(j => new Date(j.done).toDateString() === new Date().toDateString());
  const todaySum = todayDone.reduce((acc, j) => acc + (j.amt || 0), 0);
  const todayNetProfit = todaySum > 0 ? todaySum - calculatedFuelCost : 0;
  const progressPct = Math.min(100, Math.max(0, (todaySum / goal) * 100));

  const totalSum = doneJobs.reduce((acc, j) => acc + (j.amt || 0), 0);
  const avgJob = completedJobs.length ? (totalSum / completedJobs.length).toFixed(0) : 0;

  // AUTOMATIC HOURLY EARNINGS CALCULATION
  const todayAllJobs = jobs.filter(j => new Date(j.at || j.done).toDateString() === new Date().toDateString());
  let hourlyEarnings = 0;
  let workHoursFormatted = "0.0";
  if (todayAllJobs.length > 0 && todaySum > 0) {
    const firstJobTime = Math.min(...todayAllJobs.map(j => j.at || j.done || Date.now()));
    const now = Date.now();
    const diffHours = Math.max(0.1, (now - firstJobTime) / (1000 * 60 * 60));
    hourlyEarnings = Math.round(todaySum / diffHours);
    workHoursFormatted = diffHours.toFixed(1);
  }

  // SMART ANALYTICS DATA
  const smartAnalytics = computeSmartRiderAnalytics(doneJobs);

  // HOTSPOT ZONES: count every completed order (not just the money-bearing batch row)
  const completedJobsWithLoc = completedJobs.filter(j => j.lat != null && j.lng != null);
  const hotspotZones = clusterZones(completedJobsWithLoc);

  // WEEKLY INCOME BREAKDOWN DATA FOR CHARTS
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString('th-TH', { weekday: 'short' });
    const dateStr = d.toDateString();
    const sum = doneJobs
      .filter(j => new Date(j.done).toDateString() === dateStr)
      .reduce((acc, j) => acc + (j.amt || 0), 0);
    return { dayStr, sum };
  });

  const maxWeeklySum = Math.max(...last7Days.map(d => d.sum), 1);

  return (
    <div className="max-w-[480px] mx-auto h-screen max-h-screen bg-[#f0fdf4] text-slate-800 flex flex-col overflow-hidden relative font-sans shadow-2xl">
      
      {/* HEADER */}
      <header className="px-4 pt-4 pb-3 bg-white shrink-0">
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2.5">
             <div className="w-9 h-9 bg-[#22c55e] rounded-xl flex items-center justify-center text-white shadow-[0_2px_0_#16a34a] shrink-0">
                <MapIcon size={18} strokeWidth={2.5} />
             </div>
             <h1 className="text-[17px] font-extrabold text-slate-900 tracking-tight">RiderApp</h1>

             {/* CLOUD SYNC BADGE */}
             {user && (
               <span className="text-[9px] font-black text-[#15803d] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                 <CloudCheck size={11} className="text-[#22c55e]" />
                 <span>คลาวด์</span>
               </span>
             )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-1.5 bg-slate-100 text-slate-600 rounded-full shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all shrink-0"
              title="ตั้งค่าขนาดหมุด"
            >
              <Sliders size={14} strokeWidth={2.5} />
            </button>

            <button
              onClick={() => {
                setTempGoal(goal.toString());
                setTempKmPerL(kmPerLiter.toString());
                setTempFuelPrice(fuelPricePerLiter.toString());
                setTempFuel(manualFuelCost.toString());
                setIsGoalModalOpen(true);
              }}
              className="p-1.5 bg-slate-100 text-slate-600 rounded-full shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all shrink-0"
              title="ตั้งเป้า"
            >
              <Target size={14} strokeWidth={2.5} />
            </button>

            {/* START/STOP SHIFT TOGGLE (pill switch) — must start a shift before accepting jobs */}
            <button
              onClick={handleToggleShift}
              className="relative w-[92px] h-[34px] rounded-full border-none shrink-0 transition-colors duration-200"
              style={{ background: currentShiftStart ? '#22c55e' : '#e2e8f0' }}
              title={currentShiftStart ? `กำลังทำงาน ${shiftElapsedLabel} ชม. แตะเพื่อหยุดงาน` : 'แตะเพื่อเริ่มงาน'}
            >
              <span
                className="absolute top-[3px] w-[28px] h-[28px] rounded-full bg-white shadow-md transition-all duration-200"
                style={{ left: currentShiftStart ? '61px' : '3px' }}
              ></span>
              <span
                className={`absolute inset-y-0 flex items-center text-[11px] font-bold ${currentShiftStart ? 'left-3 text-white' : 'right-3 text-slate-500'}`}
              >
                {currentShiftStart ? 'ออนไลน์' : 'ออฟไลน์'}
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'home' && (
          <>
            {/* GPS DISTANCE ODOMETER BADGE */}
            <div className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium mb-3 bg-slate-100 text-slate-500">
              <Gauge size={12} className="text-[#22c55e]" />
              <span>{todayKm} กม. วันนี้</span>
            </div>

            {currentShiftStart && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#15803d] mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
                <span>กำลังทำงาน {shiftElapsedLabel} ชม.</span>
              </div>
            )}

            {/* HERO EARNINGS CARD */}
            <div className="rounded-[20px] p-5 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-[0_10px_24px_-10px_rgba(22,163,74,0.55)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-semibold text-white/80">รายได้วันนี้</span>
                {todayAllJobs.length > 0 && todaySum > 0 && (
                  <div className="flex items-center gap-1 bg-white/20 rounded-xl pl-1.5 pr-2.5 py-0.5">
                    <Clock size={11} className="text-white" />
                    <span className="text-[11px] font-bold text-white">{workHoursFormatted} ชม. · ฿{hourlyEarnings}/ชม.</span>
                  </div>
                )}
              </div>

              <div className="text-[34px] font-extrabold text-white tracking-tight leading-tight mb-1">
                ฿{todaySum.toLocaleString()}
              </div>

              {calculatedFuelCost > 0 && todaySum > 0 && (
                <div className="text-[12px] font-semibold text-white/85 mb-3.5">
                  กำไรสุทธิ ฿{todayNetProfit.toLocaleString()} <span className="text-white/60">(หักค่าน้ำมัน ฿{calculatedFuelCost})</span>
                </div>
              )}

              <div className="flex gap-5 mb-4">
                <div>
                  <div className="text-[11px] text-white/70 mb-0.5">ระยะทาง</div>
                  <div className="text-sm font-bold text-white">{todayKm} กม.</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/70 mb-0.5">งานที่วิ่ง</div>
                  <div className="text-sm font-bold text-white">{todayDone.length} งาน</div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11.5px] text-white/80 font-semibold">เป้าหมายวันนี้</span>
                <span className="text-[11.5px] text-white font-bold">฿{todaySum.toLocaleString()} / ฿{goal.toLocaleString()}</span>
              </div>
              <div className="h-[7px] rounded-full bg-white/25">
                <div
                  className="h-[7px] rounded-full bg-white transition-all duration-500 ease-out relative"
                  style={{ width: `${progressPct}%` }}
                >
                  {progressPct >= 100 && <div className="absolute inset-0 bg-white/40 animate-pulse rounded-full"></div>}
                </div>
              </div>
            </div>
          </>
        )}
      </header>


      {/* MAIN CONTENT */}
      <main className="flex-1 p-3 overflow-y-auto space-y-3 pb-24">
        
        {/* PWA INSTALL BANNER IF AVAILABLE (mobile only — desktop browsers can trigger this too but it's not useful there) */}
        {isMobileDevice && deferredInstallPrompt && !isAppInstalled && (
          <div className="bg-[#dcfce7] border-2 border-[#22c55e] p-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#22c55e] text-white flex items-center justify-center font-black shrink-0">
                <Smartphone size={20} strokeWidth={2.5} />
              </div>
              <div>
                <span className="font-extrabold text-[#15803d] text-xs block">ติดตั้งแอปบนหน้าจอมือถือ</span>
                <span className="text-[10px] font-bold text-slate-600 block">เปิดใช้งานได้ทันที ไม่ต้องเข้าผ่านเบราว์เซอร์</span>
              </div>
            </div>
            <button 
              onClick={handleInstallApp}
              className="px-3 py-1.5 bg-[#22c55e] hover:bg-[#1fbd58] text-white font-extrabold text-xs rounded-lg shadow-[0_2px_0_#16a34a] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 shrink-0"
            >
              <Download size={13} strokeWidth={3} />
              <span>ติดตั้ง</span>
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-200 space-y-3">

            {/* FULL-WIDTH JOB ADD BUTTONS */}
            <div>
              {activeJobs.length === 0 ? (
                <button
                  onClick={addJobToCurrentBatch}
                  disabled={!currentShiftStart}
                  className="w-full py-4 rounded-2xl border-none font-bold text-[16px] transition-all disabled:cursor-not-allowed"
                  style={currentShiftStart
                    ? { background: '#22c55e', color: '#fff', cursor: 'pointer' }
                    : { background: '#e4e7e5', color: '#9ca3a0' }
                  }
                >
                  + รับงานใหม่
                </button>
              ) : (
                <div className="w-full flex gap-2">
                  <button
                    onClick={addJobToCurrentBatch}
                    disabled={!currentShiftStart}
                    className="flex-1 py-4 rounded-2xl border-none font-bold text-[15px] transition-all disabled:cursor-not-allowed"
                    style={currentShiftStart
                      ? { background: '#22c55e', color: '#fff', cursor: 'pointer' }
                      : { background: '#e4e7e5', color: '#9ca3a0' }
                    }
                  >
                    + เพิ่มในชุดนี้
                  </button>

                  <button
                    onClick={startNewBatch}
                    disabled={!currentShiftStart}
                    className="flex-1 py-4 rounded-2xl border-none font-bold text-[15px] transition-all disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    style={currentShiftStart
                      ? { background: '#171B1A', color: '#fff', cursor: 'pointer' }
                      : { background: '#e4e7e5', color: '#9ca3a0' }
                    }
                  >
                    <Layers size={16} strokeWidth={2.5} className="shrink-0" />
                    <span>เริ่มชุดใหม่</span>
                  </button>
                </div>
              )}
              {!currentShiftStart && (
                <div className="text-center mt-2 text-[12.5px] text-[#9CA39F]">
                  เปิดสถานะ "ออนไลน์" ก่อน เพื่อเริ่มรับงาน
                </div>
              )}
            </div>

            {/* ACTIVE BATCHES LIST */}
            {activeBatchIds.map((bId) => {
              const bJobs = activeJobs.filter(j => (j.batchId || 1) === bId);
              if (bJobs.length === 0) return null;

              return (
                <div key={bId} className="bg-white p-4 rounded-[18px] border-[1.5px] border-[#CDEFDD] shadow-[0_4px_16px_-8px_rgba(15,169,104,0.3)] animate-in fade-in duration-200 space-y-2.5">
                  <div className="flex justify-between items-center pb-2">
                    <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0C8A56]">
                      <Package size={16} className="text-[#22c55e] shrink-0" />
                      <span>ชุดงานที่ {bId} ({bJobs.length} ออเดอร์)</span>
                    </div>
                    <span className="text-[11px] font-bold text-white bg-[#0FA968] px-2.5 py-0.5 rounded-[10px]">
                      รอลงยอดรวม
                    </span>
                  </div>

                  {/* List of active orders */}
                  <div className="space-y-1.5">
                    {bJobs.map((job, idx) => (
                      <div key={job.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-[#22c55e] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                            #{bJobs.length - idx}
                          </span>
                          <div>
                            <span className="font-bold text-slate-700 text-[11px] block">
                              รับ {new Date(job.at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.
                            </span>
                            
                            <button 
                              onClick={() => handleViewJobOnMap(job)}
                              className="mt-0.5 px-2 py-0.5 bg-[#dcfce7] text-[#16a34a] hover:bg-[#22c55e] hover:text-white rounded-md font-extrabold text-[10px] flex items-center gap-1 transition-all shadow-2xs border border-[#bbf7d0]"
                            >
                              <Compass size={11} strokeWidth={2.5} />
                              <span>ส่องพิกัดจุดนี้</span>
                            </button>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => setJobToDelete(job.id)} 
                          className="px-2.5 py-1 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 rounded-md font-extrabold text-[11px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                        >
                          <X size={12} strokeWidth={3} />
                          <span>ยกเลิก</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* SEPARATE BATCH FINISH INPUT */}
                  <div className="pt-1 flex gap-2">
                    <input 
                      type="number" 
                      value={batchAmounts[bId] || ''}
                      onChange={e => setBatchAmounts({ ...batchAmounts, [bId]: e.target.value })}
                      placeholder={`ยอดรวมชุดที่ ${bId} (บาท)`} 
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-[#22c55e]/40 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-bold"
                    />
                    <button 
                      onClick={() => finishSpecificBatch(bId)}
                      className="bg-[#22c55e] text-white font-bold px-3 shrink-0 rounded-lg flex items-center justify-center shadow-[0_2px_0_#16a34a] active:translate-y-0.5 active:shadow-none border border-white transition-all text-xs whitespace-nowrap"
                    >
                      <CheckCircle2 size={15} strokeWidth={2.5} className="mr-1" />
                      <span>จบชุดที่ {bId}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Today's History Snippet */}
            <div>
              <h2 className="text-[14px] font-bold text-[#171B1A] mb-2">เสร็จสิ้นวันนี้ ({todayDone.length})</h2>
              {todayDone.length === 0 ? (
                 <div className="border-[1.5px] border-dashed border-[#E7ECE9] rounded-2xl py-7 px-4 text-center">
                   <span className="text-[13.5px] text-[#9CA39F] leading-relaxed">ยังไม่มีงานที่จบวันนี้<br/>ไปออนไลน์แล้วกดรับงานได้เลย</span>
                 </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {todayDone.map((job) => (
                    <div key={job.id} className="flex items-center gap-3 bg-[#F8FAF9] rounded-[14px] px-3.5 py-3">
                      <div className="w-[34px] h-[34px] rounded-full bg-[#E8F7EF] flex items-center justify-center text-[#0FA968] shrink-0">
                        <CheckCircle2 size={16} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold text-[#171B1A] block">
                          {new Date(job.done).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.
                        </span>
                        {job.count && job.count > 1 && (
                          <span className="text-[11.5px] text-[#9CA39F]">ชุดงาน {job.count} ออเดอร์</span>
                        )}
                      </div>
                      <span className="text-[13.5px] font-bold text-[#0C8A56] shrink-0">+฿{job.amt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="h-[280px] rounded-xl overflow-hidden shadow-sm bg-white relative border-2 border-white">
              
              {/* LIVE TRACKING BADGE */}
              <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs border border-slate-100 flex items-center gap-1.5 text-[10px] font-extrabold text-slate-700">
                <Radio size={12} className="text-[#22c55e] animate-pulse" />
                <span>กำลังติดตามพิกัดเรียลไทม์</span>
              </div>

              <MapContainer center={focusedCoords || userCoords} zoom={mapZoom} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <MapController
                  coords={focusedCoords || userCoords}
                  zoom={mapZoom}
                  onZoomChange={setCurrentZoomLevel}
                  isFollowing={isFollowing}
                  onUserDrag={() => setIsFollowing(false)}
                  focusTrigger={focusTrigger}
                />
                
                {/* ACTIVE JOB PINS */}
                {currentZoomLevel < 13 ? (
                  activeJobs.length > 0 && (
                    <Marker position={userCoords} icon={createCompactClusterIcon(activeJobs.length)} zIndexOffset={150}>
                      <Popup>
                        <div className="text-center font-sans p-1">
                          <p className="font-extrabold text-amber-600 text-xs">📦 รวม {activeJobs.length} ออเดอร์กำลังส่ง</p>
                          <p className="text-[10px] text-slate-400">ซูมเข้าไปใกล้เพื่อดูรายชิ้น</p>
                        </div>
                      </Popup>
                    </Marker>
                  )
                ) : (
                  activeJobs.map((job, idx) => (
                    <Marker key={job.id} position={[job.lat || userCoords[0], job.lng || userCoords[1]]} icon={createJobIcon(activeJobs.length - idx, idx)} zIndexOffset={100 + idx}>
                      <Popup>
                        <div className="text-center font-sans p-1">
                          <p className="font-extrabold text-[#16a34a] text-xs">จุดรับงาน #{activeJobs.length - idx}</p>
                          <p className="text-[10px] text-slate-600 font-bold">ชุดงานที่ {job.batchId || 1}</p>
                          <p className="text-[10px] text-slate-400">รับเมื่อ {new Date(job.at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))
                )}

                {/* HOTSPOT ZONES */}
                {currentZoomLevel >= 12 && hotspotZones.map((z, idx) => {
                  if (z.n < 1) return null;
                  return (
                    <Fragment key={idx}>
                      <Circle 
                        center={[z.lat, z.lng]} 
                        radius={Math.max(z.rKm * 1000, 300)} 
                        pathOptions={{ 
                          color: idx === 0 ? '#ef4444' : '#22c55e', 
                          fillColor: idx === 0 ? '#ef4444' : '#22c55e', 
                          fillOpacity: 0.18,
                          weight: 2
                        }}
                      />
                      <Marker position={[z.lat, z.lng]} icon={createHotspotIcon(idx + 1, z.n)} zIndexOffset={10}>
                        <Popup>
                          <div className="text-center font-sans p-1">
                            <p className="font-extrabold text-red-600 text-xs">โซนงานแน่นอันดับ #{idx + 1}</p>
                            <p className="text-[10px] text-slate-600 font-bold">ทำได้ {z.n} ออเดอร์</p>
                          </div>
                        </Popup>
                      </Marker>
                    </Fragment>
                  );
                })}

                {/* 🛵 RIDER MOTORCYCLE ICON */}
                <Marker position={userCoords} icon={createRiderIcon(riderIconSize, userHeading)} zIndexOffset={2000}>
                  <Popup>
                    <div className="text-center font-sans p-1">
                      <p className="font-extrabold text-slate-800 text-xs">ตำแหน่งของคุณ (กำลังขับขี่ 🛵)</p>
                      <p className="text-[10px] text-slate-400 font-bold">ขนาดหมุด: {riderIconSize}px</p>
                    </div>
                  </Popup>
                </Marker>

              </MapContainer>

              <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
                 <button 
                   onClick={() => setIsSettingsModalOpen(true)}
                   className="h-9 px-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center justify-center shadow-md border border-slate-200 active:scale-95 transition-all"
                   title="ปรับขนาดหมุด"
                 >
                   <Sliders size={15} strokeWidth={2.5} />
                 </button>

                 <button
                   onClick={handleLocateMe}
                   className={`h-9 px-3 rounded-lg flex items-center gap-1 text-white active:translate-y-0.5 active:shadow-none transition-all text-xs font-bold ${
                     isFollowing
                       ? 'bg-[#16a34a] shadow-[0_2px_0_#15803d] ring-2 ring-[#22c55e]/50'
                       : 'bg-[#22c55e] hover:bg-[#1fbd58] shadow-[0_2px_0_#16a34a]'
                   }`}
                 >
                   <Navigation size={15} strokeWidth={2.5} className={isFollowing ? 'animate-pulse' : ''} />
                   <span>ติดตามฉัน</span>
                 </button>
              </div>
            </div>

            {/* HOTSPOT ZONES RANKING LIST */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 space-y-2">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Flame size={18} className="text-orange-500 fill-orange-500" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">โซนงานแน่น (Popular Hotspots)</h3>
              </div>

              {hotspotZones.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 py-3 text-center">ยังไม่มีข้อมูลโซน — เริ่มรับงานในพื้นที่ต่างๆ ระบบจะจัดอันดับให้อัตโนมัติ</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {hotspotZones.slice(0, 3).map((zone, idx) => {
                    const distKm = haversine(userCoords[0], userCoords[1], zone.lat, zone.lng).toFixed(1);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black text-white ${idx === 0 ? 'bg-orange-500' : 'bg-[#22c55e]'}`}>
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-800 text-xs block">โซนที่ {idx + 1} ({zone.n} ออเดอร์)</span>
                            <span className="text-[10px] font-bold text-slate-400">ห่างจากคุณ {distKm} กม.</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setIsFollowing(false);
                            setFocusedCoords([zone.lat, zone.lng]);
                            setMapZoom(16);
                            setFocusTrigger(t => t + 1);
                          }}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-bold text-[11px] text-[#22c55e] hover:bg-[#dcfce7] transition-colors"
                        >
                          ดูพิกัด ›
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATS TAB WITH GPS ODOMETER & AUTO FUEL CALCULATION */}
        {activeTab === 'stats' && (
          <div className="animate-in fade-in duration-200 space-y-3">
             <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">รายได้รวมทั้งหมด</p>
                   <p className="text-xl font-extrabold text-[#22c55e]">฿{totalSum.toLocaleString()}</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">กำไรสุทธิวันนี้</p>
                   <p className="text-xl font-extrabold text-[#16a34a]">฿{todayNetProfit.toLocaleString()}</p>
                   {calculatedFuelCost > 0 && todaySum > 0 && (
                     <p className="text-[10px] font-bold text-slate-400 mt-0.5">(ค่าน้ำมัน ฿{calculatedFuelCost})</p>
                   )}
                </div>

                {/* AUTOMATIC GPS DISTANCE ODOMETER CARD */}
                <div className="bg-slate-800 p-4 rounded-xl shadow-[0_3px_0_#0f172a] col-span-2 flex justify-between items-center text-white">
                   <div>
                     <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">ระยะทางขับขี่วัดจาก GPS วันนี้</p>
                     <p className="text-2xl font-black text-white">{todayKm} <span className="text-xs font-bold text-slate-400">กิโลเมตร</span></p>
                     <p className="text-[10px] font-bold text-[#4ade80] mt-0.5">
                       ค่าน้ำมันอัตโนมัติ: ฿{calculatedFuelCost} ({kmPerLiter} กม./ลิตร • ฿{fuelPricePerLiter}/ลิตร)
                     </p>
                   </div>
                   <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-[#4ade80] shrink-0">
                      <Gauge size={22} strokeWidth={2.5} />
                   </div>
                </div>

                {/* AUTOMATIC HOURLY EARNINGS CARD */}
                <div className="bg-[#22c55e] p-4 rounded-xl shadow-[0_3px_0_#16a34a] col-span-2 flex justify-between items-center text-white">
                   <div>
                     <p className="text-[10px] font-extrabold text-white/80 uppercase tracking-wider mb-0.5">รายได้เฉลี่ยวันนี้ (คำนวณจากงานแรก)</p>
                     <p className="text-2xl font-black">฿{hourlyEarnings} <span className="text-xs font-bold text-white/80">/ ชั่วโมง</span></p>
                     <p className="text-[10px] font-bold text-white/90 mt-0.5">วิ่งงานมาแล้ว {workHoursFormatted} ชั่วโมง (รายได้วันนี้ ฿{todaySum.toLocaleString()})</p>
                   </div>
                   <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                      <TrendingUp size={22} strokeWidth={2.5} />
                   </div>
                </div>
             </div>

             {/* WEEKLY INCOME BAR CHART */}
             <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                   <div className="flex items-center gap-1.5">
                      <BarChart2 size={18} className="text-[#22c55e]" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">กราฟสรุปรายได้ 7 วันล่าสุด</h3>
                   </div>
                   <span className="text-[10px] font-bold text-slate-400">บาท/วัน</span>
                </div>

                <div className="flex items-end justify-between gap-1 h-32 pt-4 px-1">
                   {last7Days.map((d, i) => {
                     const barHeightPct = Math.round((d.sum / maxWeeklySum) * 100);
                     return (
                       <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                         <span className="text-[9px] font-black text-slate-600 mb-1 opacity-90">
                           {d.sum > 0 ? `฿${d.sum}` : ''}
                         </span>
                         <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-full">
                           <div 
                             style={{ height: `${Math.max(barHeightPct, 6)}%` }} 
                             className={`w-full rounded-t-lg transition-all duration-500 ${d.sum > 0 ? 'bg-[#22c55e] group-hover:bg-[#16a34a]' : 'bg-slate-200'}`}
                           ></div>
                         </div>
                         <span className="text-[10px] font-extrabold text-slate-500 mt-1.5">{d.dayStr}</span>
                       </div>
                     );
                   })}
                </div>
             </div>

             {/* SMART WORK INSIGHTS */}
             <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                   <Zap size={18} className="text-amber-500 fill-amber-500" />
                   <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">วิเคราะห์ช่วงเวลาทำเงินชุกสุด (Smart Insights)</h3>
                </div>

                {doneJobs.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 py-3 text-center">เริ่มรับงานเพื่อสะสมข้อมูลวิเคราะห์วันและเวลาปังที่สุดของคุณ</p>
                ) : (
                  <div className="space-y-2.5">
                    
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black shrink-0">
                          <Calendar size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">วันที่ออเดอร์ปังที่สุด</span>
                          <span className="text-sm font-black text-slate-800">
                            {smartAnalytics.peakDay ? smartAnalytics.peakDay.name : 'กำลังสะสมข้อมูล'}
                          </span>
                        </div>
                      </div>
                      
                      {smartAnalytics.peakDay && (
                        <div className="text-right">
                          <span className="text-xs font-black text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200 inline-block shadow-2xs">
                            {smartAnalytics.peakDay.count} ออเดอร์
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 block mt-0.5">฿{smartAnalytics.peakDay.amt.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#dcfce7] border border-[#bbf7d0] p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#22c55e] text-white flex items-center justify-center font-black shrink-0">
                          <Award size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-[#15803d] uppercase tracking-wider block">ช่วงเวลาทอง (งานแน่นสุด)</span>
                          <span className="text-xs font-black text-slate-800">
                            {smartAnalytics.peakTimeSlot ? smartAnalytics.peakTimeSlot.name : 'กำลังสะสมข้อมูล'}
                          </span>
                        </div>
                      </div>

                      {smartAnalytics.peakTimeSlot && (
                        <div className="text-right">
                          <span className="text-xs font-black text-[#15803d] bg-white px-2 py-0.5 rounded-full border border-[#bbf7d0] inline-block shadow-2xs">
                            {smartAnalytics.peakTimeSlot.count} ออเดอร์
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">สถิติจำนวนงานแบ่งตามช่วงเวลา</p>
                      <div className="space-y-1.5">
                        {Object.keys(smartAnalytics.timeSlotStats).map((slotName) => {
                          const count = smartAnalytics.timeSlotStats[slotName];
                          const maxC = Math.max(...Object.values(smartAnalytics.timeSlotStats), 1);
                          const pct = Math.round((count / maxC) * 100);

                          return (
                            <div key={slotName} className="text-xs">
                              <div className="flex justify-between font-bold text-slate-600 mb-0.5 text-[11px]">
                                <span>{slotName}</span>
                                <span className="font-extrabold text-slate-800">{count} ออเดอร์</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#22c55e] rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
             </div>

          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-200 space-y-2">
             <div className="flex justify-between items-center mb-1 px-1">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ประวัติการรับงานทั้งหมด ({doneJobs.length})</h2>
                
                {doneJobs.length > 0 && (
                  <button 
                    onClick={() => setIsClearAllHistoryModalOpen(true)}
                    className="text-[10px] font-extrabold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md border border-red-200 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={11} />
                    <span>ล้างประวัติทั้งหมด</span>
                  </button>
                )}
             </div>

             <div className="bg-white rounded-xl p-2 shadow-sm border border-slate-100 space-y-1.5 max-h-[380px] overflow-y-auto">
                {doneJobs.length === 0 && <div className="py-8 text-center text-slate-400 font-bold text-xs">ยังไม่มีประวัติการรับงาน</div>}
                {[...doneJobs].reverse().map(job => (
                  <div key={job.id} className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-100 hover:bg-slate-100/80 transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#dcfce7] rounded-lg flex items-center justify-center text-[#22c55e] shrink-0 shadow-2xs">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-800 text-base leading-tight">฿{job.amt}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {new Date(job.done).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} • {new Date(job.done).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                          {job.count && job.count > 1 ? ` (${job.count} ออเดอร์)` : ''}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setHistoryToDelete(job.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="ลบรายการนี้"
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* SYNC TAB & CLOUD FIREBASE DASHBOARD & PWA INSTALL INFO */}
        {activeTab === 'sync' && (
          <div className="animate-in fade-in duration-200 space-y-3">
            <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-slate-100 space-y-4">
              
              {user ? (
                <div>
                  <div className="w-16 h-16 mx-auto mb-2 rounded-xl p-1 bg-[#dcfce7] shadow-sm">
                    <div className="w-full h-full rounded-lg overflow-hidden border border-white">
                      <img src={user.photoURL || "https://img.daisyui.com/images/profile/demo/batperson@192.webp"} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  
                  <h3 className="font-extrabold text-base text-[#1e293b] mb-0.5">{user.displayName || "Rider"}</h3>
                  <p className="text-[11px] font-bold text-slate-400 mb-3 bg-slate-50 inline-block px-2.5 py-0.5 rounded-full">{user.email}</p>

                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-left text-xs mb-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[#15803d] font-extrabold">
                      <ShieldCheck size={16} />
                      <span>ซิงค์ข้อมูลบน Firebase Cloud เรียบร้อย</span>
                    </div>
                    <p className="text-slate-600 font-semibold text-[11px] leading-relaxed">
                      ข้อมูลประวัติงาน ค่าน้ำมันคำนวณจาก GPS ระยะทางเป้าหมาย และการตั้งค่าของคุณถูกบันทึกบนระบบคลาวด์ปลอดภัยแล้ว
                    </p>
                  </div>

                  <button onClick={() => signOut(auth)} className="w-full py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs rounded-xl shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all">
                    ออกจากระบบ
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner">
                     <User size={28} strokeWidth={2} />
                  </div>
                  <h3 className="font-extrabold text-base text-[#1e293b] mb-1">ซิงค์ข้ามอุปกรณ์ด้วย Google</h3>
                  <p className="text-xs font-semibold text-slate-400 mb-4 px-2 leading-relaxed">
                    เข้าสู่ระบบด้วย Google เพื่อบันทึกประวัติการรับงานบน Firebase Cloud ป้องกันข้อมูลหายเวลาล้างแคชหรือเปลี่ยนเครื่อง
                  </p>
                  <button onClick={() => signInWithPopup(auth, provider)} className="w-full py-3 bg-[#4285F4] hover:bg-[#3367d6] text-white font-extrabold text-xs rounded-xl shadow-[0_3px_0_#2b5cbf] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>
                    <span>ล็อกอินด้วย Google บันทึกลงคลาวด์</span>
                  </button>
                </div>
              )}
            </div>

            {/* PWA INSTALL INSTRUCTIONS CARD */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-800 font-extrabold text-xs">
                <Smartphone size={16} className="text-[#22c55e]" />
                <span>วิธีติดตั้งเป็นแอปจริงบนมือถือ (Add to Home Screen)</span>
              </div>

              <div className="text-xs font-semibold text-slate-600 space-y-2 leading-relaxed pt-1">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-extrabold text-slate-800 block mb-0.5">📱 บน Android (Chrome):</span>
                  <span>กดปุ่มเมนู 3 จุดมุมบนขวา &rarr; เลือก <strong className="text-[#22c55e]">"ติดตั้งแอป (Install app)"</strong> หรือ <strong className="text-[#22c55e]">"เพิ่มลงในหน้าจอหลัก"</strong></span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-extrabold text-slate-800 block mb-0.5">🍏 บน iPhone (Safari):</span>
                  <span>กดปุ่ม <strong className="text-[#22c55e]">"แชร์ (Share)"</strong> ด้านล่าง &rarr; เลื่อนลงเลือก <strong className="text-[#22c55e]">"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"</strong></span>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* FIXED NAVIGATION */}
      <div className="absolute bottom-2 left-2 right-2 z-40">
        <nav className="bg-white border border-slate-200 shadow-lg rounded-xl p-1 flex justify-between">
          <NavTab id="home" label="หน้าแรก" icon={Home} active={activeTab} set={setActiveTab} />
          <NavTab id="map" label="แผนที่" icon={MapIcon} active={activeTab} set={setActiveTab} />
          <NavTab id="stats" label="สถิติ" icon={BarChart2} active={activeTab} set={setActiveTab} />
          <NavTab id="history" label="ประวัติ" icon={HistoryIcon} active={activeTab} set={setActiveTab} />
          <NavTab id="sync" label="บัญชี" icon={User} active={activeTab} set={setActiveTab} user={user} />
        </nav>
      </div>

      {/* IN-APP MODAL: PIN SIZE SETTINGS WITH LIVE PREVIEW */}
      {isSettingsModalOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[330px] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5">
                <Sliders size={18} className="text-[#22c55e]" />
                <h3 className="font-extrabold text-base text-slate-800">ตั้งค่าขนาดหมุดมอเตอร์ไซค์</h3>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs font-semibold text-slate-400 mb-2">ปรับขนาดเลื่อนสไลเดอร์เพื่อดูตัวอย่างจริงด้านล่าง</p>

            {/* LIVE PREVIEW UI BOX */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center my-3 relative overflow-hidden h-28">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ตัวอย่างขนาดจริง (Live Preview)</span>
              
              <div className="relative flex items-center justify-center h-12">
                <span style={{ width: `${riderIconSize}px`, height: `${riderIconSize}px` }} className="animate-ping absolute inline-flex rounded-full bg-[#22c55e] opacity-60"></span>
                <div 
                  style={{ width: `${riderIconSize}px`, height: `${riderIconSize}px`, fontSize: `${Math.round(riderIconSize * 0.45)}px` }} 
                  className="bg-[#22c55e] text-white rounded-full border-2 border-white shadow-xl flex items-center justify-center font-black relative"
                >
                  🛵
                </div>
              </div>

              <span className="text-xs font-black text-[#22c55e] mt-2 bg-[#dcfce7] px-2.5 py-0.5 rounded-full">
                {riderIconSize}px
              </span>
            </div>

            {/* RANGE SLIDER INPUT */}
            <div className="space-y-1.5 mb-5 px-1">
              <div className="flex justify-between text-[11px] font-extrabold text-slate-500">
                <span>เล็ก (24px)</span>
                <span>มาตรฐาน (36px)</span>
                <span>ใหญ่ (56px)</span>
              </div>
              <input 
                type="range" 
                min="24" 
                max="56" 
                value={riderIconSize}
                onChange={(e) => setRiderIconSize(Number(e.target.value))}
                className="w-full accent-[#22c55e] h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <button 
              onClick={() => setIsSettingsModalOpen(false)}
              className="w-full py-2.5 bg-[#22c55e] text-white font-bold text-xs rounded-xl shadow-[0_2px_0_#16a34a] active:translate-y-0.5 active:shadow-none transition-all"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: CONFIRM DELETE JOB */}
      {jobToDelete !== null && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[320px] shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <h3 className="font-extrabold text-base text-slate-800 mb-1">ยกเลิกงานนี้?</h3>
            <p className="text-xs font-semibold text-slate-400 mb-5">คุณต้องการยกเลิกการรับงานนี้ใช่หรือไม่</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setJobToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ย้อนกลับ
              </button>
              <button 
                onClick={confirmDeleteJob}
                className="flex-1 py-2.5 bg-red-500 text-white font-bold text-xs rounded-xl shadow-[0_2px_0_#b91c1c] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: CONFIRM STOP SHIFT WHILE JOBS ARE STILL PENDING */}
      {isStopShiftModalOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[320px] shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <h3 className="font-extrabold text-base text-slate-800 mb-1">ยังมีงานค้างอยู่</h3>
            <p className="text-xs font-semibold text-slate-400 mb-5">คุณยังมีออเดอร์ที่ยังไม่ลงยอดสำเร็จ ต้องการหยุดงานเลยใช่ไหม</p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsStopShiftModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={stopShift}
                className="flex-1 py-2.5 bg-amber-500 text-white font-bold text-xs rounded-xl shadow-[0_2px_0_#b45309] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ยืนยันหยุดงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: CONFIRM DELETE SINGLE HISTORY ITEM */}
      {historyToDelete !== null && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[320px] shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} strokeWidth={2.5} />
            </div>
            <h3 className="font-extrabold text-base text-slate-800 mb-1">ลบประวัติรายการนี้?</h3>
            <p className="text-xs font-semibold text-slate-400 mb-5">รายการประวัติและยอดเงินจะถูกลบออกจากระบบและแผนที่ทันที</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setHistoryToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ยกเลิก
              </button>
              <button 
                onClick={confirmDeleteHistoryItem}
                className="flex-1 py-2.5 bg-red-500 text-white font-bold text-xs rounded-xl shadow-[0_2px_0_#b91c1c] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: CONFIRM CLEAR ALL HISTORY */}
      {isClearAllHistoryModalOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[320px] shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <h3 className="font-extrabold text-base text-slate-800 mb-1">ล้างประวัติทั้งหมด?</h3>
            <p className="text-xs font-semibold text-slate-400 mb-5">ประวัติการรับงาน คลาวด์ หมุดโซนบนแผนที่ และสถิติต่างๆ จะถูกลบถาวรเป็น 0</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsClearAllHistoryModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ยกเลิก
              </button>
              <button 
                onClick={confirmClearAllHistory}
                className="flex-1 py-2.5 bg-red-500 text-white font-bold text-xs rounded-xl shadow-[0_2px_0_#b91c1c] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: EDIT GOAL & FUEL EXPENSE & AUTO DISTANCE CALCULATOR SETTINGS */}
      {isGoalModalOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 w-full max-w-[340px] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-800">ตั้งเป้าหมาย & คำนวณน้ำมัน</h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">เป้าหมายรายวัน (บาท)</label>
              <input 
                type="number" 
                value={tempGoal} 
                onChange={(e) => setTempGoal(e.target.value)}
                placeholder="เช่น 1000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-[#22c55e]/40"
              />
            </div>

            {/* AUTO FUEL VS MANUAL TOGGLE */}
            <div className="border-t border-slate-100 pt-2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                  <Gauge size={14} className="text-[#22c55e]" />
                  <span>คำนวณน้ำมันจาก GPS ระยะทาง</span>
                </label>
                
                <button 
                  onClick={() => setIsAutoFuel(!isAutoFuel)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-all ${isAutoFuel ? 'bg-[#22c55e] justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {isAutoFuel ? (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="col-span-2">
                    <label className="text-[10px] font-extrabold text-slate-500 block mb-1">ชนิดน้ำมันที่เติม</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFuelType(key)}
                          className={`py-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                            fuelType === key
                              ? 'bg-[#22c55e] text-white border-[#22c55e]'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 block mb-0.5">อัตราประหยัด (กม./ลิตร)</label>
                    <input 
                      type="number" 
                      value={tempKmPerL} 
                      onChange={(e) => setTempKmPerL(e.target.value)}
                      placeholder="45"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-extrabold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 block mb-0.5">ราคาน้ำมัน (บาท/ลิตร)</label>
                    <input
                      type="number"
                      value={tempFuelPrice}
                      onChange={(e) => setTempFuelPrice(e.target.value)}
                      placeholder="38"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-extrabold text-amber-700 outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={fetchLatestFuelPrice}
                      disabled={isFetchingFuelPrice}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-extrabold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={12} strokeWidth={2.5} className={isFetchingFuelPrice ? 'animate-spin' : ''} />
                      <span>{isFetchingFuelPrice ? 'กำลังดึงราคา...' : `ดึงราคาน้ำมันล่าสุด (${FUEL_TYPE_LABELS[fuelType]})`}</span>
                    </button>
                    {fuelPriceFetchedAt && !fuelPriceFetchError && (
                      <p className="text-[10px] font-bold text-[#22c55e] mt-1 text-center">อัปเดตราคาล่าสุดวันที่ {fuelPriceFetchedAt} แล้ว</p>
                    )}
                    {fuelPriceFetchError && (
                      <p className="text-[10px] font-bold text-red-500 mt-1 text-center">ดึงราคาไม่สำเร็จ กรอกราคาเองได้เลย</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">ค่าน้ำมันระบุเอง (บาท)</label>
                  <input 
                    type="number" 
                    value={tempFuel} 
                    onChange={(e) => setTempFuel(e.target.value)}
                    placeholder="เช่น 100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-extrabold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setIsGoalModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all"
              >
                ยกเลิก
              </button>
              <button 
                onClick={saveGoalAndFuel}
                className="flex-1 py-2.5 bg-[#22c55e] text-white font-bold text-xs rounded-xl shadow-[0_2px_0_#16a34a] active:translate-y-0.5 active:shadow-none transition-all"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function NavTab({ id, label, icon: Icon, active, set, user }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => set(id)}
      className={`relative flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-all duration-150 ${isActive ? 'bg-[#22c55e] text-white shadow-[0_2px_0_#16a34a]' : 'text-slate-[#94a3b8] hover:text-slate-600'}`}
    >
      {id === 'sync' && user && !isActive ? (
         <div className="w-4 h-4 rounded-md overflow-hidden border border-white shadow-sm opacity-90 mb-0.5">
            <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
         </div>
      ) : (
         <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className="mb-0.5" />
      )}
      <span className="text-[10px] font-bold leading-none">{label}</span>
    </button>
  );
}
