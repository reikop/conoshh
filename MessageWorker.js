import axios from "axios";

export default class MessageWorker {

    constructor() {
        /**
         *
         * @private
         */
        this._api = axios.create({
            // baseURL : 'https://api-aion.plaync.com',
        });
    }

    receiveMessage(msg){}

    /**
     *
     * @return {import('axios').AxiosInstance}
     */
    get api(){
        return this._api;
    }
}