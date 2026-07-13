// Core CARE endpoints the notifications recipient pickers need (patients,
// staff) - unrelated to the care_im_wrapper backend plugin, so kept
// separate from lib/api/notifications.ts.
import { HttpMethod, PaginatedResponse, apiRoutes } from "@/lib/request";
import { UserBase } from "@/lib/types/common";
import { PatientListRead } from "@/lib/types/patient";

export const patientApi = apiRoutes({
  list: {
    path: "/api/v1/patient/",
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<PatientListRead>,
  },
});

export const userApi = apiRoutes({
  list: {
    path: "/api/v1/users/",
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<UserBase>,
  },
});
