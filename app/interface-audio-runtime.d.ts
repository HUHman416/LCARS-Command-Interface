export type InterfaceAudioResult={ok:boolean;status:string;asset?:string;output?:string;error?:string};
export type InterfaceAudioState={enabled:boolean;owner:boolean;phase:string;playing:boolean;volume:number};
export interface InterfaceAudioController{
 owner:boolean;
 startup(force?:boolean):Promise<InterfaceAudioResult>;
 setAmbiance(enabled:boolean):Promise<InterfaceAudioResult>;
 resume():Promise<InterfaceAudioResult>;
 setVolume(percent:number):void;
 sync(theme:string,enabled:boolean,percent:number):Promise<InterfaceAudioResult>|void;
 status():InterfaceAudioState;
 suspend():void;
}
export function installInterfaceAudio(win:Window):InterfaceAudioController;
