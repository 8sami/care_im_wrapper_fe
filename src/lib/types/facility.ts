// Local mirror of care_fe's FacilityRead, trimmed to the fields this plugin
// actually reads.
export interface FacilityRead {
  id: string;
  name: string;
  permissions: string[];
}
