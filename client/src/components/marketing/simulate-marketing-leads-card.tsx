import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Users, Loader2, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

type PipelineSelector = 'b2c' | 'b2b' | 'both';

export function SimulateMarketingLeadsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = () => localStorage.getItem("marketingToken") || "";

  const [pipelineType, setPipelineType] = useState<PipelineSelector>('both');
  const [volume, setVolume] = useState(20);
  const [spreadStages, setSpreadStages] = useState(true);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const seedMutation = useMutation({
    mutationFn: async () => {
      setInlineError(null);
      const res = await fetch('/api/simulate/marketing-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          pipeline_type: pipelineType,
          count: volume,
          stage_distribution: spreadStages ? 'spread' : 'stage_1_only',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulation failed');
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Simulation Complete',
        description: `Created ${data.leadsGenerated} leads in the ${data.marketingDepartment} pipeline.`,
      });
      queryClient.invalidateQueries({ queryKey: ['cic', 'pipeline'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('No marketing department')) {
        setInlineError(
          'No marketing department configured. Go to Settings → Departments to flag one.'
        );
      } else {
        setInlineError(error.message);
      }
    },
  });

  return (
    <Card className="border-2 border-dashed border-[#004E98]/20 hover:border-[#004E98]/40 transition-colors rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#004E98]/10 rounded-xl">
            <FlaskConical className="h-5 w-5 text-[#004E98]" />
          </div>
          <div>
            <CardTitle className="text-base font-black">
              Marketing Leads — CIC Pipeline
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Seeds realistic B2C and B2B leads across all 5 stages with authentic Kenyan
              names, counties, CIC products, and KES premium ranges.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Pipeline type selector */}
        <div>
          <Label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2 block">
            Pipeline Type
          </Label>
          <div className="flex gap-2">
            {(['b2c', 'b2b', 'both'] as PipelineSelector[]).map((t) => (
              <button
                key={t}
                onClick={() => setPipelineType(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                  pipelineType === t
                    ? 'bg-[#004E98] text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Volume slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-black uppercase tracking-widest text-gray-400">
              Leads per pipeline type
            </Label>
            <Badge variant="outline" className="font-black text-[#004E98] border-[#004E98]/20">
              {volume}
            </Badge>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-[#004E98]"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>5</span><span>50</span>
          </div>
        </div>

        {/* Stage distribution toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Spread across all stages</Label>
            <p className="text-xs text-gray-400">
              {spreadStages
                ? '40% Lead / 30% Prospect / 15% Quote / 10% Policy / 5% Terminal'
                : 'All leads placed at Stage 1 (Lead) only'}
            </p>
          </div>
          <Switch checked={spreadStages} onCheckedChange={setSpreadStages} />
        </div>

        {/* Read-only note */}
        <p className="text-xs text-gray-400 italic border-t pt-3">
          Leads will be assigned to the department flagged as the marketing department.
          If no marketing department is set, simulation will prompt you to configure one first.
        </p>

        {/* Inline error */}
        {inlineError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">{inlineError}</p>
          </div>
        )}

        {/* Run button */}
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="w-full bg-[#004E98] hover:bg-[#003B75] font-black"
        >
          {seedMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Seeding leads...</>
          ) : (
            <><Users className="h-4 w-4 mr-2" />Run Simulation</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
