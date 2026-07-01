import { listScenarios, runScenario } from "../services/incidentScenarios.js";

//These are controllers function to simulate incidents
//LATENCY_SPIKE
export const getSlowRequest=async(req,res)=>{
    try{
        console.log("[SIMULATION] Slow request started");
        await new Promise(resolve =>
        setTimeout(resolve, 10000)
        );
        console.log("[SIMULATION] Slow request finished");
        res.status(200).json({ status: 'ok', latencyMS:10000 });
    }
    catch(error){
        res.status(500).json({ status: 'error', message: error.message });
    }
}
//ERROR_SPIKE
export const getErrorRequest=async(req,res)=>{
    try{
        throw new Error("Invalid GoogleMap API Key");
    }
    catch(error){
        res.status(500).json({ status: 'error', message: error.message });
    }
}
//CPU_SPIKE
export const getCPUSpikeRequest=async(req,res)=>{
    try{
    console.log(
    "[SIMULATION] CPU spike started"
    );

    const end = Date.now() + 20000;

    while (Date.now() < end) {
        Math.sqrt(Math.random());
    }

    console.log(
        "[SIMULATION] CPU spike finished"
    );

    res.json({
        success: true,
        durationSeconds: 10,
    });
    }
    catch(err){
        res.status(500).json({ status: 'error', message: err.message });
    }
}
//MEMORY_SPIKE
const memoryLeak=[]
export const getMemorySpike=async(req,res)=>{
    memoryLeak.push(
        Buffer.alloc(500 * 1024 * 1024)
    );

    res.json({
        memoryChunks: memoryLeak.length
    });
}
//Get the list of manufactured incidents
export const getIncidentScenarios=(req,res)=>{
    res.json({
        scenarios: listScenarios()
    });
}
// Run a selected incident
export const runIncidentScenario=async(req,res)=>{
    const result = await runScenario(req.params.scenario);

    if (!result) {
        return res.status(404).json({
            status: "error",
            message: `I haven't created this incident yet: ${req.params.scenario}`,
            availableScenarios: listScenarios().map((scenario) => scenario.name)
        });
    }

    const { scenario, requestId } = result;

    res.status(scenario.httpStatus).json({
        status: scenario.httpStatus >= 500 ? "error" : "ok",
        scenario: scenario.name,
        type: scenario.type,
        requestId,
        affectedServices: scenario.affectedServices,
        signals: scenario.signals,
        expectedRootCause: scenario.expectedRootCause
    });
}
