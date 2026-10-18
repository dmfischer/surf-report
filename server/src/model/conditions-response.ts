export class ConditionsResponse {
    zipCode: string;
    description: string;

    constructor(zipCode: string, description: string) {
        this.zipCode = zipCode;
        this.description = description;
    }
}