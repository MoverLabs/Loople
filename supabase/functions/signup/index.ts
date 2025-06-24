import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  Club,
  User,
  ApiResponse,
  ParticipantRole,
  MemberType,
} from "../_shared/types.ts";
import {
  createSupabaseClient,
  validateEmail,
  validateRequiredFields,
  handleCors,
  buildResponse,
  buildErrorResponse,
  cleanupResources,
} from '../_shared/utils.ts'

// Define TypeScript interfaces for request and response
interface SignupRequest {
  email: string;
  password: string;
  data: {
    first_name: string;
    last_name: string;
    phone?: string;
    club_name?: string;
    club_subdomain?: string;
    birth_date?: string;
  };
}

interface SignupResponseData {
  user: {
    id: string;
    email: string;
    name: string;
  };
  club?: Club;
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let createdUserId: string | undefined;
  let createdClubId: string | undefined;
  let supabaseClient: any;

  try {
    console.log("Starting signup process...");
    
    // Parse and validate request
    const requestData: SignupRequest = await req.json();
    console.log("Request data received:", { 
      email: requestData.email,
      hasPassword: !!requestData.password,
      hasClubData: !!(requestData.data.club_name && requestData.data.club_subdomain)
    });

    // Validate required fields
    const requiredFields = ['email', 'password'] as const;
    const fieldError = validateRequiredFields(requestData, requiredFields);
    if (fieldError) {
      throw new Error(fieldError);
    }

    // Validate email format
    if (!validateEmail(requestData.email)) {
      throw new Error('Invalid email format');
    }

    // Initialize Supabase client
    supabaseClient = createSupabaseClient(req);

    // Check if user already exists
    console.log("Checking for existing user...");
    const { data: existingUser, error: userError } = await supabaseClient
      .from("users")
      .select("id, email")
      .eq("email", requestData.email.trim().toLowerCase())
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("Error checking existing user:", userError);
      throw userError;
    }

    if (existingUser) {
      console.log("User already exists:", existingUser.email);
      throw new Error(`User with email ${requestData.email} already exists`);
    }

    // Create new user
    console.log("Creating new user...");
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: requestData.email,
      password: requestData.password,
      options: {
        data: {
          ...requestData.data,
          full_name: `${requestData.data.first_name} ${requestData.data.last_name}`,
          role: requestData.data.club_name ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
        },
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }
    createdUserId = authData.user?.id;
    console.log("User created successfully:", createdUserId);

    let clubData: Club | undefined = undefined;
    if (requestData.data.club_name && requestData.data.club_subdomain) {
      console.log("Starting club creation...");
      // Check if subdomain is available
      const { data: existingClub, error: subdomainError } = await supabaseClient
        .from("clubs")
        .select("id")
        .eq("subdomain", requestData.data.club_subdomain)
        .single();

      if (subdomainError && subdomainError.code !== "PGRST116") {
        console.error("Error checking subdomain:", subdomainError);
        await cleanupResources(supabaseClient, { userId: createdUserId });
        throw subdomainError;
      }

      if (existingClub) {
        console.log("Subdomain already taken:", requestData.data.club_subdomain);
        await cleanupResources(supabaseClient, { userId: createdUserId });
        throw new Error("Club subdomain already taken");
      }

      // Create new club
      console.log("Creating new club...");
      const { data: newClub, error: clubError } = await supabaseClient
        .from("clubs")
        .insert({
          name: requestData.data.club_name,
          subdomain: requestData.data.club_subdomain,
          owner_id: authData.user?.id,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (clubError) {
        console.error("Club creation error:", clubError);
        await cleanupResources(supabaseClient, { userId: createdUserId });
        throw clubError;
      }
      createdClubId = newClub.id;
      console.log("Club created successfully:", createdClubId);
      clubData = newClub;
    }

    // Create user record in the public.users table
    console.log("Creating user record...");
    const { error: dbUserError } = await supabaseClient.from("users").insert({
      id: authData.user?.id,
      email: requestData.email,
      first_name: requestData.data.first_name,
      last_name: requestData.data.last_name,
      phone: requestData.data.phone,
      is_active: true,
      role_id: requestData.data.club_name ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
      club_id: clubData?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (dbUserError) {
      console.error("Error creating user record:", dbUserError);
      await cleanupResources(supabaseClient, { userId: createdUserId, clubId: createdClubId });
      throw dbUserError;
    }
    console.log("User record created successfully");

    // Add user as member if club was created
    if (clubData) {
      console.log("Creating member record...");
      const { error: memberError } = await supabaseClient.from("members").insert({
        club_id: clubData.id,
        user_id: authData.user?.id,
        first_name: requestData.data.first_name,
        last_name: requestData.data.last_name,
        email: requestData.email,
        phone: requestData.data.phone,
        date_of_birth: requestData.data.birth_date
          ? new Date(requestData.data.birth_date).toISOString()
          : undefined,
        member_type: MemberType.ADULT,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (memberError) {
        console.error("Member creation error:", memberError);
        await cleanupResources(supabaseClient, { userId: createdUserId, clubId: createdClubId });
        throw memberError;
      }
      console.log("Member record created successfully");
    }

    // Return successful response
    const responseData: SignupResponseData = {
      user: {
        id: authData.user?.id ?? "",
        email: authData.user?.email ?? "",
        name: authData.user?.user_metadata?.full_name ?? "",
      },
      club: clubData,
    };

    console.log("Signup process completed successfully");
    return buildResponse(responseData);
  } catch (error) {
    // Handle errors and cleanup
    console.error("Signup process failed:", error);
    
    // Only clean up if we haven't already handled it in a specific case
    if (createdUserId || createdClubId) {
      console.log("Starting cleanup in catch block...", { createdUserId, createdClubId });
      await cleanupResources(supabaseClient, { userId: createdUserId, clubId: createdClubId });
      console.log("Cleanup completed in catch block");
    }

    return buildErrorResponse(error, 500);
  }
});

