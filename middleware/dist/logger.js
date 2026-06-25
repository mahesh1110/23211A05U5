"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Log;
const node_fetch_1 = __importDefault(require("node-fetch"));
const stacks = ['backend', 'frontend'];
const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
const backendPackages = ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service'];
const frontendPackages = ['api', 'component', 'hook', 'page', 'state', 'style'];
const sharedPackages = ['auth', 'config', 'middleware', 'utils'];
async function Log(stack, level, packageName, message) {
    if (!stacks.includes(stack))
        throw new Error('invalid stack');
    if (!levels.includes(level))
        throw new Error('invalid level');
    const allPackages = [...backendPackages, ...frontendPackages, ...sharedPackages];
    if (!allPackages.includes(packageName))
        throw new Error('invalid package');
    const token = process.env.LOG_SERVICE_TOKEN || process.env.ACCESS_TOKEN || '';
    const response = await (0, node_fetch_1.default)('http://4.224.186.213/evaluation-service/logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stack, level, package: packageName, message })
    });
    return response.json();
}
