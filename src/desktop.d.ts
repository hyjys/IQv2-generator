export {};
declare global {
  interface Window {
    desktop?: {
      openDocument(): Promise<{path:string;text:string}|null>;
      saveDocument(options:{text:string;suggestedName?:string;path?:string}):Promise<{path:string}|null>;
      chooseImage():Promise<{name:string;src:string;bytes:number}|null>;
      exportPdf(options:{title:string;html:string;mode?:'questions'|'answers'}):Promise<{path:string}|null>;
      appInfo():Promise<{version:string;platform:string}>;
      openService(options:{service:'hafstudy'|'hafquiz'|'imsiquiz'|'exam';text?:string}):Promise<{service:string;url:string;staged:boolean}>;
    };
  }
}
