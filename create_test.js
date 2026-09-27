const fs = require('fs');
const html = fs.readFileSync('pactoMD.html', 'utf8');
const scriptContent = html.split('<!-- Lógica de Javascript -->')[1].split('</script>')[0].replace('<script>', '');

const mockScript = `
const document = {
    addEventListener: (event, cb) => {
        global.run = cb;
    },
    getElementById: (id) => {
        if (id === 'pacto-data') return { textContent: 'CAPITULO 1\\nArtículo 1\\nHola mundo' };
        if (id === 'articles-container') return { innerHTML: '', appendChild: () => {} };
        return { innerHTML: '', appendChild: () => {}, querySelectorAll: () => [], classList: {add:()=>{}, remove:()=>{}}, addEventListener: ()=>{} };
    },
    createElement: () => {
        return { classList: {add:()=>{}, remove:()=>{}}, innerHTML: '', dataset: {} };
    }
};
const window = { matchMedia: () => ({matches: false}) };
const localStorage = { getItem: () => null, setItem: () => {} };
` + scriptContent + `
try {
    run();
    console.log('Success!');
} catch (e) {
    console.error('Error running script:', e);
}
`;

fs.writeFileSync('test.js', mockScript);
