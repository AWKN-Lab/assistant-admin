import '@testing-library/react';
// TDesign and React 18 use ResizeObserver for sizing in jsdom.
class MockResizeObserver { observe(){} unobserve(){} disconnect(){} }
(globalThis as any).ResizeObserver = MockResizeObserver;
if (!window.matchMedia) window.matchMedia = () => ({matches:false,media:'',onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}});
