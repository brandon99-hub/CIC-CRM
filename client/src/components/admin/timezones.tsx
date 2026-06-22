import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Globe, Clock, DollarSign, Plus, Pencil, Trash2, MapPin, Search, AlertCircle } from "lucide-react";
import { Region } from "@/lib/RegionContext";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { COUNTRIES, CountryData } from "@/lib/countries";

// Fallback list of generic global timezones
const ALL_TIMEZONES = (() => {
  try {
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch (e) {
    return ["Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Europe/London", "America/New_York", "Asia/Dubai"];
  }
})();

export function Timezones() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    currency: string;
    language: string;
    supportedLanguages: string[];
    timezone: string;
    isActive: boolean;
  }>({
    name: "",
    code: "",
    currency: "",
    language: "",
    supportedLanguages: [],
    timezone: "",
    isActive: true
  });

  // Fetch Database Regions
  const { data: dbData, isLoading: isLoadingDb } = useQuery({
    queryKey: ["admin", "regions"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/regions");
      return res.json();
    },
  });

  const regions: Region[] = dbData?.regions || [];

  // Mutations
  const { mutate: saveRegion, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (editingRegion) {
        const res = await apiRequest(`/api/admin/regions/${editingRegion.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update region");
      } else {
        const res = await apiRequest("/api/admin/regions", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to create region");
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: `Region ${editingRegion ? 'updated' : 'created'} successfully.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "regions"] });
      setModalOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save region.", variant: "destructive" });
    },
  });

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const res = await apiRequest(`/api/admin/regions/${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete region");
      toast({ title: "Success", description: "Region deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin", "regions"] });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete region. You might lack permissions.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const { mutate: toggleRegion } = useMutation({
    mutationFn: async ({ id, isActive }: { id: string, isActive: boolean }) => {
      const res = await apiRequest(`/api/admin/regions/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle region");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "regions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle region.", variant: "destructive" });
    },
  });

  // Modal Handlers
  const openModal = (region?: Region) => {
    if (region) {
      setEditingRegion(region);
      setFormData({
        name: region.name,
        code: region.code || "",
        currency: region.currency || "",
        language: region.language || "",
        supportedLanguages: region.supportedLanguages || [region.language || "English"],
        timezone: region.timezone || "",
        isActive: region.isActive !== undefined ? region.isActive : true
      });
    } else {
      setEditingRegion(null);
      setFormData({ name: "", code: "", currency: "", language: "", supportedLanguages: [], timezone: "", isActive: true });
    }
    setModalOpen(true);
  };

  const handleCountryChange = (countryName: string | null) => {
    if (!countryName) return;
    
    const country = COUNTRIES.find((c: CountryData) => c.name === countryName);
    if (!country) return;

    // Attempt to guess Timezone by capital
    let guessedTz = "";
    if (country.capital) {
      guessedTz = ALL_TIMEZONES.find((tz: string) => tz.includes(country.capital.replace(" ", "_"))) || "";
    }

    setFormData(prev => ({
      ...prev,
      name: countryName,
      code: country.code,
      currency: country.currency,
      language: country.languages.length === 1 ? country.languages[0] : "", // Autofill if only one language
      supportedLanguages: country.languages || [],
      timezone: guessedTz
    }));
  };

  // Dropdown Options
  const countryOptions = useMemo(() => {
    return COUNTRIES
      .map((c: CountryData) => ({ id: c.name, label: c.name }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, []);

  const activeCountryLanguages = useMemo(() => {
    if (!formData.name) return [];
    const country = COUNTRIES.find((c: CountryData) => c.name === formData.name);
    if (!country || !country.languages) return [];
    return country.languages.map(l => ({ id: l, label: l }));
  }, [formData.name]);

  const timezoneOptions = useMemo(() => {
    return ALL_TIMEZONES.map((tz: string) => ({ id: tz, label: tz.replace(/_/g, " ") }));
  }, []);

  if (isLoadingDb) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
      </div>
    );
  }

  const filteredRegions = regions.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header matching service-categories.tsx style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#004E98]/10 p-3 rounded-lg">
            <Globe className="h-6 w-6 text-[#004E98]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 leading-none">Timezones & Regional Capabilities</h3>
            <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Manage geographical regions for multi-currency and localization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Filter by country or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
            />
          </div>
          <Button onClick={() => openModal()} className="bg-[#004E98] hover:bg-[#004E98]/90 shadow-md transition-all hover:scale-[1.02]">
            <Plus className="h-4 w-4 mr-2" />Add Region
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRegions.map((region) => {
          const isActive = region.isActive !== false; // Default to true if undefined
          return (
            <Card key={region.id} className={`transition-all duration-200 border-2 group ${isActive ? 'border-[#004E98] shadow-md shadow-blue-900/10' : 'border-gray-100 shadow-sm opacity-70 hover:opacity-100'}`}>
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-[#004E98]/10 text-[#004E98]' : 'bg-gray-100 text-gray-400'}`}>
                    <Globe className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#004E98] hover:bg-blue-50" onClick={() => openModal(region)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={() => setDeleteConfirm({ isOpen: true, id: region.id, name: region.name })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Switch 
                      checked={isActive} 
                      onCheckedChange={(checked) => toggleRegion({ id: region.id, isActive: checked })}
                      className={isActive ? 'data-[state=checked]:bg-[#004E98]' : ''}
                    />
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900">{region.name}</h3>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">{region.code}</p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{region.currency}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-xs">{region.timezone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Region Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
          <div className="max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <DialogHeader>
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <Globe className="h-5 w-5 text-[#004E98]" />
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    {editingRegion ? "Modify Region" : "New Geographic Region"}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-gray-500 text-sm mt-3">
                  {editingRegion ? "Update the core parameters for this region." : "Define a new geographical region for your organization."}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-6 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">Country Name</Label>
                    <SearchableSelect 
                      options={countryOptions}
                      value={formData.name || null}
                      onValueChange={handleCountryChange}
                      placeholder="Select Country..."
                      searchPlaceholder="Search countries..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">Country Code</Label>
                    <Input
                      value={formData.code}
                      readOnly
                      placeholder="Autofilled"
                      className="border-gray-200 bg-gray-50 text-gray-500 h-11 font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">Currency Code</Label>
                    <Input
                      value={formData.currency}
                      readOnly
                      placeholder="Autofilled"
                      className="border-gray-200 bg-gray-50 text-gray-500 h-11 uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">Supported Languages</Label>
                  <div className="flex flex-wrap gap-2">
                    {activeCountryLanguages.length > 0 ? activeCountryLanguages.map((lang) => {
                      const isSelected = formData.supportedLanguages.includes(lang.id);
                      return (
                        <button
                          key={lang.id}
                          onClick={() => {
                            setFormData(prev => {
                              const newLangs = isSelected
                                ? prev.supportedLanguages.filter(l => l !== lang.id)
                                : [...prev.supportedLanguages, lang.id];
                              // Ensure primary language is valid
                              const newPrimary = newLangs.includes(prev.language) ? prev.language : (newLangs[0] || "");
                              return { ...prev, supportedLanguages: newLangs, language: newPrimary };
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            isSelected ? 'bg-[#004E98] text-white border-[#004E98]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {lang.label}
                        </button>
                      );
                    }) : (
                      <span className="text-sm text-gray-400 italic">Select a country first</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">Primary Language</Label>
                    <SearchableSelect 
                      options={formData.supportedLanguages.map(l => ({ id: l, label: l }))}
                      value={formData.language || null}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, language: val || "" }))}
                      placeholder="Select Primary Language..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700">Timezone Identifier</Label>
                    <SearchableSelect 
                        options={timezoneOptions}
                        value={formData.timezone || null}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, timezone: val || "" }))}
                        placeholder="Select Timezone..."
                        searchPlaceholder="Search timezones (e.g. Africa/Nairobi)..."
                      />
                  </div>
                </div>

              </div>
            </div>

            <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
              <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={isSaving} className="font-semibold text-gray-500 hover:text-gray-700">Discard Changes</Button>
              <Button onClick={() => saveRegion()} disabled={isSaving || !formData.name || !formData.code || !formData.currency || !formData.timezone || !formData.language || formData.supportedLanguages.length === 0} className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform disabled:opacity-50">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingRegion ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  editingRegion ? "Save Updates" : "Create Region"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reused Confirm Delete Modal (mirrors admin-dashboard.tsx implementation) */}
      {deleteConfirm && (
        <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm(prev => prev ? { ...prev, isOpen: false } : null)}>
          <DialogContent className="sm:max-w-[420px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
            <div className="p-6 text-center">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900 text-center">Delete Region?</DialogTitle>
                <DialogDescription className="text-gray-500 text-sm mt-2 text-center">
                  Are you sure you want to delete the region <span className="font-bold text-gray-900">{deleteConfirm.name}</span>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter className="bg-gray-50/50 p-6 flex gap-3 sm:justify-center border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(prev => prev ? { ...prev, isOpen: false } : null)}
                className="flex-1 h-11 border-gray-200 text-gray-600 font-bold hover:bg-white hover:border-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete Region"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
