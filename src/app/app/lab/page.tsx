import { redirect } from 'next/navigation'

// The lab hub is retired — /app/lab goes straight to the courtside recording
// page (Tim's call, Sep 2026). The old calibration shell lived here; the
// staged Live Sim at /live superseded it. /app/lab/sim remains reachable
// directly for the desktop trainer.
export default function LabIndex() {
  redirect('/app/lab/live')
}
