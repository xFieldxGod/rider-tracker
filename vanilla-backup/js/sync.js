/**
 * Rider Job Tracker - Cloud Sync (Firebase Boilerplate)
 * 
 * วิธีการเปิดใช้งาน:
 * 1. ไปที่ https://console.firebase.google.com/
 * 2. สร้าง Project ใหม่
 * 3. เปิดใช้งาน Authentication (เลือก Google Sign-in)
 * 4. เปิดใช้งาน Firestore Database
 * 5. นำ config จาก Firebase Console มาใส่ในตัวแปร firebaseConfig ด้านล่าง
 * 6. ยกเลิกคอมเมนต์ (Uncomment) สคริปต์ Firebase ใน index.html หรือโหลดผ่าน CDN
 */

(function(){
  'use strict';
  
  // TODO: นำค่า config ของคุณมาใส่ที่นี่
  const firebaseConfig = {
    apiKey: "AIzaSyDX6w6f4NZIN0aNc09zLPPo4_tzjJiP_b8",
    authDomain: "rider-tracker-e1898.firebaseapp.com",
    projectId: "rider-tracker-e1898",
    storageBucket: "rider-tracker-e1898.firebasestorage.app",
    messagingSenderId: "1055971366451",
    appId: "1:1055971366451:web:cb5b4354f40f64433fb546",
    measurementId: "G-J9MCHTMC91"
  };

  // ตรวจสอบว่า Firebase โหลดมาหรือยัง
  const hasFirebase = typeof firebase !== 'undefined';
  
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnSyncNow = document.getElementById('btnSyncNow');
  const syncStatus = document.getElementById('syncStatus');

  if (!btnLogin) return; // ไม่ได้อยู่ในหน้าที่มีปุ่ม

  let currentUser = null;

  // Initialize Firebase (แค่โครงสร้างสมมติ หากใส่สคริปต์จริงระบบจะทำงาน)
  if (hasFirebase) {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        syncStatus.textContent = `สถานะ: ล็อกอินแล้ว (${user.displayName || user.email})`;
        syncStatus.style.color = "var(--money)";
        btnLogin.style.display = 'none';
        btnLogout.style.display = 'block';
        btnSyncNow.style.display = 'block';
      } else {
        currentUser = null;
        syncStatus.textContent = 'สถานะ: ยังไม่ได้ล็อกอิน';
        syncStatus.style.color = "var(--ink2)";
        btnLogin.style.display = 'block';
        btnLogout.style.display = 'none';
        btnSyncNow.style.display = 'none';
      }
    });

    btnLogin.onclick = () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch(err => {
        alert("ล็อกอินล้มเหลว: " + err.message);
      });
    };

    btnLogout.onclick = () => {
      auth.signOut();
    };

    btnSyncNow.onclick = () => {
      if (!currentUser) return;
      
      const localData = localStorage.getItem('rider.jobs.v1');
      if (!localData) {
        alert('ไม่มีข้อมูลในเครื่องให้ซิงค์');
        return;
      }

      btnSyncNow.textContent = 'กำลังซิงค์...';
      db.collection('rider_data').doc(currentUser.uid).set({
        jobs: JSON.parse(localData),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      .then(() => {
        btnSyncNow.textContent = 'ซิงค์ข้อมูลสำเร็จ ✓';
        setTimeout(() => { btnSyncNow.textContent = 'ซิงค์ข้อมูลตอนนี้'; }, 3000);
      })
      .catch(err => {
        alert('ซิงค์ข้อมูลล้มเหลว: ' + err.message);
        btnSyncNow.textContent = 'ซิงค์ข้อมูลตอนนี้';
      });
    };
  } else {
    // ถ้ายังไม่ได้ใส่ Firebase script ให้แจ้งเตือนก่อน
    btnLogin.onclick = () => {
      alert("ระบบ Cloud Sync เป็นแบบจำลอง (Placeholder) \\nกรุณานำ Firebase Config ไปใส่ใน js/sync.js และเพิ่ม Script ของ Firebase ในหน้า index.html ก่อนใช้งานจริงครับ");
    };
  }
})();
