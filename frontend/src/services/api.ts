import axios from 'axios';
import { getApiBase } from '../util/UrlUtil';

const api = axios.create({
    baseURL: getApiBase(),
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    },
});

export interface ResponseBody {
    success: boolean,
    data: any
}

export const getRequest = async (endpoint: string, params = {}): Promise<ResponseBody> => {
    try {
        const response = await api.get(endpoint, { params, withCredentials: true });
        return {success: true, data: response.data};
    } catch (error) {
        return handleError(error);
    }
};

export const postRequest = async (endpoint: string, data: any): Promise<ResponseBody> => {
    try {
        const headers = data instanceof FormData
            ? {'Content-Type': 'application/form'} // Let the browser set the correct `Content-Type` for FormData
            : { 'Content-Type': 'application/json' };

        const response = await api.post(endpoint, data, { headers });
        return { success: true, data: response.data };
    } catch (error) {
        return handleError(error);
    }
};

const handleError = (error: any) => {
    if (error.response) {
        const { data } = error.response;
        return { success: false, data: data?.message || 'An error occurred' };
    } else if (error.request) {
        return { success: false, data: 'No response from server' };
    } else {
        return { success: false, data: error.message || 'Something went wrong' };
    }
};


export default api;
