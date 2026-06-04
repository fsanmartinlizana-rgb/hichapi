import { NextRequest, NextResponse } from 'next/server';
import { searchRestaurants } from '../../../../lib/discovery';
import { ChapiIntent } from '../../../../lib/types';

export async function POST(req: NextRequest) {
  try {
    const { intent } = await req.json();
    
    const searchIntent: ChapiIntent = {
      cuisine_type: intent?.cuisine_type || null,
      zone: intent?.zone || null,
      budget_clp: intent?.budget_clp || null,
      dietary_restrictions: intent?.dietary_restrictions || [],
      dish_keyword: intent?.dish_keyword || null,
    };

    console.log('[API Search Mobile] Intent:', searchIntent);
    const out = await searchRestaurants(searchIntent);
    console.log(`[API Search Mobile] Found ${out.results.length} results. Zone resolved to: ${out.resolved_zone}`);
    
    return NextResponse.json(out);
  } catch (error: any) {
    console.error('Mobile search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
