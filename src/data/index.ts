import hartleyJson from "./hartley-test2.json";
import marineDriveJson from "./marine-drive.json";
import type { AuditSample } from "./types";

export type { AuditSample, FailedCheck, PassedCheck } from "./types";

export const marineDrive = marineDriveJson as AuditSample;
export const hartley = hartleyJson as AuditSample;

export const sampleList: AuditSample[] = [marineDrive, hartley];
