/**
 * Auth & Session Manager
 * Mengelola status login, role guard, session di localStorage, dan deteksi Jenis Kelamin
 */

const AUTH_STORAGE_KEY = '7kaih_user_session';

// Master Data Jenis Kelamin 357 Siswa ('L' = Laki-laki, 'P' = Perempuan)
const STUDENT_GENDER_MAP = {
  "12243": "P",
  "12244": "P",
  "12245": "L",
  "12246": "L",
  "12247": "P",
  "12248": "L",
  "12249": "L",
  "12250": "L",
  "12251": "L",
  "12252": "P",
  "12253": "P",
  "12254": "P",
  "12255": "L",
  "12256": "L",
  "12257": "P",
  "12258": "L",
  "12259": "P",
  "12260": "P",
  "12261": "P",
  "12262": "P",
  "12263": "P",
  "12264": "L",
  "12265": "L",
  "12266": "P",
  "12267": "P",
  "12268": "P",
  "12269": "P",
  "12270": "P",
  "12271": "L",
  "12272": "L",
  "12273": "L",
  "12275": "L",
  "12276": "P",
  "12277": "L",
  "12278": "L",
  "12279": "P",
  "12280": "L",
  "12281": "L",
  "12282": "P",
  "12283": "P",
  "12284": "L",
  "12285": "P",
  "12286": "L",
  "12287": "L",
  "12288": "L",
  "12289": "P",
  "12290": "P",
  "12291": "P",
  "12292": "P",
  "12293": "P",
  "12294": "P",
  "12295": "P",
  "12296": "L",
  "12297": "P",
  "12298": "P",
  "12299": "L",
  "12300": "L",
  "12301": "L",
  "12302": "L",
  "12303": "L",
  "12304": "P",
  "12305": "P",
  "12306": "P",
  "12307": "L",
  "12308": "L",
  "12309": "L",
  "12310": "L",
  "12312": "L",
  "12313": "P",
  "12314": "L",
  "12315": "P",
  "12316": "P",
  "12317": "P",
  "12318": "L",
  "12319": "P",
  "12320": "L",
  "12321": "L",
  "12322": "P",
  "12324": "L",
  "12325": "L",
  "12326": "P",
  "12327": "P",
  "12328": "P",
  "12330": "P",
  "12331": "L",
  "12332": "L",
  "12333": "L",
  "12334": "L",
  "12335": "L",
  "12336": "L",
  "12337": "L",
  "12338": "L",
  "12339": "L",
  "12340": "L",
  "12341": "L",
  "12342": "P",
  "12344": "P",
  "12345": "P",
  "12346": "P",
  "12347": "L",
  "12348": "L",
  "12349": "L",
  "12350": "L",
  "12351": "L",
  "12353": "L",
  "12354": "L",
  "12355": "L",
  "12356": "L",
  "12357": "L",
  "12358": "L",
  "12359": "L",
  "12360": "L",
  "12361": "L",
  "12362": "L",
  "12363": "L",
  "12364": "L",
  "12365": "L",
  "12366": "L",
  "12367": "L",
  "12368": "L",
  "12369": "L",
  "12370": "L",
  "12371": "L",
  "12372": "L",
  "12373": "L",
  "12374": "P",
  "12375": "P",
  "12376": "P",
  "12377": "P",
  "12378": "L",
  "12379": "L",
  "12380": "L",
  "12381": "P",
  "12382": "P",
  "12383": "P",
  "12384": "L",
  "12385": "P",
  "12387": "P",
  "12388": "P",
  "12389": "P",
  "12390": "P",
  "12392": "L",
  "12393": "P",
  "12394": "P",
  "12395": "P",
  "12396": "L",
  "12397": "L",
  "12398": "L",
  "12399": "P",
  "12400": "L",
  "12401": "P",
  "12402": "L",
  "12404": "L",
  "12405": "L",
  "12406": "L",
  "12407": "L",
  "12408": "P",
  "12409": "L",
  "12410": "L",
  "12411": "P",
  "12412": "P",
  "12413": "P",
  "12414": "P",
  "12415": "P",
  "12416": "P",
  "12417": "P",
  "12418": "P",
  "12419": "L",
  "12420": "P",
  "12422": "L",
  "12423": "L",
  "12424": "L",
  "12425": "L",
  "12426": "P",
  "12427": "P",
  "12428": "P",
  "12429": "L",
  "12430": "P",
  "12431": "L",
  "12432": "L",
  "12433": "P",
  "12434": "L",
  "12435": "L",
  "12436": "P",
  "12437": "L",
  "12441": "L",
  "12442": "L",
  "12444": "L",
  "12445": "P",
  "12446": "P",
  "12447": "L",
  "12448": "L",
  "12449": "L",
  "12450": "L",
  "12451": "L",
  "12452": "L",
  "12453": "L",
  "12454": "L",
  "12455": "L",
  "12456": "L",
  "12457": "L",
  "12458": "P",
  "12459": "P",
  "12460": "L",
  "12461": "P",
  "12463": "P",
  "12464": "L",
  "12465": "P",
  "12466": "L",
  "12467": "L",
  "12468": "L",
  "12469": "L",
  "12470": "P",
  "12471": "L",
  "12472": "P",
  "12473": "P",
  "12474": "P",
  "12475": "P",
  "12476": "P",
  "12477": "P",
  "12478": "L",
  "12479": "P",
  "12480": "L",
  "12481": "P",
  "12482": "L",
  "12483": "L",
  "12484": "P",
  "12485": "L",
  "12486": "L",
  "12487": "P",
  "12488": "P",
  "12489": "L",
  "12490": "P",
  "12491": "P",
  "12492": "L",
  "12493": "L",
  "12494": "L",
  "12495": "L",
  "12496": "P",
  "12497": "P",
  "12498": "L",
  "12499": "P",
  "12500": "L",
  "12501": "L",
  "12502": "L",
  "12503": "P",
  "12504": "P",
  "12505": "P",
  "12506": "L",
  "12507": "P",
  "12508": "L",
  "12509": "L",
  "12510": "L",
  "12511": "L",
  "12512": "P",
  "12513": "P",
  "12514": "P",
  "12515": "L",
  "12516": "P",
  "12517": "P",
  "12518": "P",
  "12519": "P",
  "12520": "P",
  "12521": "P",
  "12522": "L",
  "12523": "L",
  "12524": "L",
  "12525": "L",
  "12526": "L",
  "12527": "L",
  "12528": "L",
  "12529": "L",
  "12530": "P",
  "12531": "P",
  "12532": "P",
  "12533": "L",
  "12534": "L",
  "12535": "L",
  "12536": "L",
  "12537": "L",
  "12538": "L",
  "12539": "L",
  "12540": "L",
  "12541": "L",
  "12542": "L",
  "12543": "L",
  "12544": "L",
  "12545": "L",
  "12546": "L",
  "12547": "L",
  "12548": "L",
  "12549": "L",
  "12550": "L",
  "12551": "L",
  "12552": "L",
  "12553": "L",
  "12554": "L",
  "12555": "P",
  "12556": "P",
  "12557": "P",
  "12558": "P",
  "12559": "P",
  "12560": "P",
  "12561": "P",
  "12562": "P",
  "12563": "P",
  "12564": "P",
  "12565": "P",
  "12566": "P",
  "12567": "P",
  "12568": "P",
  "12569": "L",
  "12570": "P",
  "12571": "P",
  "12572": "L",
  "12573": "L",
  "12574": "P",
  "12575": "L",
  "12576": "P",
  "12577": "L",
  "12578": "L",
  "12579": "L",
  "12580": "P",
  "12581": "L",
  "12582": "P",
  "12583": "P",
  "12584": "L",
  "12585": "P",
  "12586": "P",
  "12587": "P",
  "12588": "P",
  "12589": "P",
  "12590": "L",
  "12591": "P",
  "12592": "L",
  "12593": "L",
  "12594": "L",
  "12595": "P",
  "12596": "P",
  "12597": "L",
  "12598": "P",
  "12599": "P",
  "12600": "L",
  "12601": "P",
  "12602": "P",
  "12603": "P",
  "12604": "P",
  "12605": "L",
  "12606": "P",
  "12607": "P",
  "12608": "P",
  "12609": "P",
  "12610": "P",
  "12611": "P",
  "12612": "P",
  "12613": "L",
  "12614": "L"
};

const Auth = {
  /**
   * Cek apakah user adalah perempuan / siswi
   * @param {Object} user - objek user session
   * @returns {boolean}
   */
  isFemale(user) {
    if (!user) return false;
    const jk = String(user.jk || user.jenisKelamin || user.gender || '').toUpperCase();
    if (jk === 'P' || jk === 'PEREMPUAN' || jk === 'WANITA' || jk === 'F') return true;
    if (jk === 'L' || jk === 'LAKI-LAKI' || jk === 'PRIA' || jk === 'M') return false;

    // Fallback lookup dari STUDENT_GENDER_MAP berdasarkan UID (Nomor Induk)
    const uid = String(user.uid || '').trim();
    if (uid && STUDENT_GENDER_MAP[uid]) {
      return STUDENT_GENDER_MAP[uid] === 'P';
    }
    return false;
  },

  /**
   * Dapatkan jenis kelamin user ('L' atau 'P')
   */
  getGender(uid) {
    const clean = String(uid || '').trim();
    return STUDENT_GENDER_MAP[clean] || 'L';
  },

  /**
   * Simpan user ke localStorage dengan jaminan field jk terisi
   */
  saveUser(user) {
    if (user && !user.jk && user.uid) {
      user.jk = this.getGender(user.uid);
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  },

  /**
   * Ambil data user yang sedang login
   */
  getUser() {
    try {
      const data = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!data) return null;
      const user = JSON.parse(data);
      if (user && !user.jk && user.uid) {
        user.jk = this.getGender(user.uid);
      }
      return user;
    } catch (e) {
      console.error('Error parsing session:', e);
      return null;
    }
  },

  /**
   * Cek apakah user sedang login
   */
  isLoggedIn() {
    return !!this.getUser();
  },

  /**
   * Logout dan redirect ke login.html
   */
  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'login.html';
  },

  /**
   * Guard halaman: memastikan user login & memiliki role yang sesuai
   * @param {string} requiredRole - 'peserta' | 'admin' | null (sembarang login)
   */
  requireAuth(requiredRole = null) {
    const user = this.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      if (user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return null;
    }

    return user;
  },

  /**
   * Guard untuk halaman login: jika sudah login, langsung redirect ke halaman sesuai role
   */
  redirectIfLoggedIn() {
    const user = this.getUser();
    if (user) {
      if (user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }
  },

  /**
   * Render pill info user di header aplikasi
   */
  renderHeaderUser() {
    const userPillEl = document.getElementById('headerUserPill');
    const userNameEl = document.getElementById('headerUserName');
    const logoutBtn = document.getElementById('logoutBtn');

    const user = this.getUser();
    if (user && userPillEl) {
      userPillEl.style.display = 'inline-flex';
      if (userNameEl) {
        userNameEl.textContent = user.nama + ' (' + (user.role === 'admin' ? 'Admin' : user.kelas) + ')';
      }
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
          this.logout();
        }
      });
    }
  }
};
