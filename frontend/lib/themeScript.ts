export const THEME_KEY = "npd-theme";

/** <head>에서 첫 그리기 전에 실행: 저장된 테마(없으면 시스템 설정)를 적용해 깜빡임을 막는다 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
