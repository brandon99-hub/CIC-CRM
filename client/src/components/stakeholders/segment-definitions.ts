export const SEGMENT_DEFINITIONS: Record<string, string> = {
    // Engagement & Risk
    "detractor": "Stakeholders with recent negative feedback, high escalation rates, or SLA breaches.",
    "promoter": "Highly engaged stakeholders likely to recommend CIC products.",
    "churn_risk": "Stakeholders showing signs of decreasing engagement, lapsed status, or unresolved issues.",
    
    // Lifecycle & Value
    "renewal_due": "Stakeholders with a policy renewing within the next 60 days.",
    "renewal_urgent": "Stakeholders with a policy renewing within the next 14 days.",
    "lapsed_policyholder": "Clients whose policies expired over 30 days ago without renewal.",
    "new_client": "Stakeholders whose accounts were created within the last 30 days.",
    "high_value": "Clients with multiple active policies or a long claims-free history.",
    
    // Products
    "product_motor": "Stakeholders holding Motor insurance policies.",
    "product_life": "Stakeholders holding Life insurance policies.",
    "product_medical": "Stakeholders holding Medical insurance policies.",
    "product_property": "Stakeholders holding Property insurance policies.",
    "product_marine": "Stakeholders holding Marine insurance policies.",
    "product_pension": "Stakeholders enrolled in Pension schemes.",
    "product_group_life": "Stakeholders holding Group Life insurance.",
    "product_micro_insurance": "Stakeholders holding Micro-insurance policies.",
    
    // Partnerships & Organization Types
    "sacco_partner": "Active SACCO or Cooperative partnerships.",
    "corporate_scheme": "Active Corporate Client schemes.",
    "agent_active": "Active sales agents driving business.",
    
    // Demographics
    "international": "Stakeholders located outside Kenya."
};

export const getSegmentDescription = (segmentName: string): string => {
    // Clean dynamic prefix if present (e.g., "seg:product_motor" -> "product_motor")
    // Also replace spaces with underscores to match dictionary keys
    const cleanName = segmentName.replace(/^seg:/, '').toLowerCase().replace(/\s+/g, '_');

    // Exact match
    if (SEGMENT_DEFINITIONS[cleanName]) {
        return SEGMENT_DEFINITIONS[cleanName];
    }
    
    // Fuzzy match
    const foundKey = Object.keys(SEGMENT_DEFINITIONS).find(k => 
        cleanName.includes(k) || k.includes(cleanName)
    );
    
    return foundKey ? SEGMENT_DEFINITIONS[foundKey] : "Segment tracking behavioral clustering or lifecycle status.";
};
