import { db } from "../db";
import { serviceCategories } from "../../shared/adminSchema";
import { determineCaseCategory } from "../routes/ai";

export interface NLPResult {
    categoryId: string | null;
    confidence: number;
    tokensFound: string[];
}

export const NLPService = {
    /**
     * Matches raw text against service categories using AI classification.
     */
    async matchCategory(text: string): Promise<NLPResult> {
        try {
            // Use Claude to intelligently determine the category based on context
            const subject = "Incoming Portal Signal";
            const result = await determineCaseCategory(subject, text);

            if (result && result.categoryName) {
                const categories = await db.select().from(serviceCategories);
                // Find the DB category that matches the AI's exact string return
                const matchedCategory = categories.find(
                    c => c.name.toLowerCase() === result.categoryName.toLowerCase()
                );

                if (matchedCategory) {
                    return {
                        categoryId: matchedCategory.id,
                        confidence: result.confidenceScore,
                        tokensFound: [result.categoryName]
                    };
                }
            }
        } catch (error) {
            console.error("[NLPService] Failed to match category using AI", error);
        }

        // Fallback if AI routing fails or doesn't match
        return {
            categoryId: null,
            confidence: 0,
            tokensFound: []
        };
    }
};
